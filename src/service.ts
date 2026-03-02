// service for the identity reconciliation API
// this is the core business logic for linking contacts.
//
// cases:
// 1. no existing contact -> create a new primary contact.
// 2. existing contacts found -> link them together.
// 3. two separate primaries found -> merge them (oldest stays primary).
// 4. new info on existing contact -> create a secondary contact.

import prisma from "./prisma";
import { Contact } from "@prisma/client";

// types
interface IdentifyRequest {
    email?: string | null;
    phoneNumber?: string | null;
}

interface IdentifyResponse {
    contact: {
        primaryContactId: number;
        emails: string[];
        phoneNumbers: string[];
        secondaryContactIds: number[];
    };
}

// main identify function
export async function identify(
    request: IdentifyRequest
): Promise<IdentifyResponse> {
    const { email, phoneNumber } = request;

    // step 1- find all existing contacts that match either email or phone
    const matchingContacts = await findMatchingContacts(email, phoneNumber);

    // case 1: no matches at all -> create a brand new primary contact
    if (matchingContacts.length === 0) {
        const newContact = await prisma.contact.create({
            data: {
                email: email || null,
                phoneNumber: phoneNumber || null,
                linkPrecedence: "primary",
            },
        });
        console.log(`Created new primary contact (id: ${newContact.id})`);
        return buildResponse(newContact, []);
    }

    // step 2- find all the primary contacts in the match set.
    // each matching contact either IS a primary or POINTS to one via linkedId.
    const primaryIds = new Set<number>();
    for (const contact of matchingContacts) {
        if (contact.linkPrecedence === "primary") {
            primaryIds.add(contact.id);
        } else if (contact.linkedId) {
            primaryIds.add(contact.linkedId);
        }
    }

    // fetch all primaries (some may not have been in our initial query)
    const primaries = await prisma.contact.findMany({
        where: { id: { in: Array.from(primaryIds) } },
        orderBy: { createdAt: "asc" },
    });

    // the oldest primary wins - it stays as the primary contact
    let primaryContact = primaries[0];

    // case 3: multiple primaries found -> merge them
    // the newer primary becomes secondary, pointing to the older one.
    // this handles the case where two separate contact groups need to merge
    // because the incoming request links them together.
    if (primaries.length > 1) {
        console.log(
            `Merging ${primaries.length} primary contacts. Primary: id ${primaryContact.id}`
        );

        // all primaries except the oldest need to become secondary
        const primaryIdsToDowngrade = primaries.slice(1).map((p) => p.id);

        await prisma.$transaction(async (tx) => {
            // downgrade newer primaries to secondary
            await tx.contact.updateMany({
                where: { id: { in: primaryIdsToDowngrade } },
                data: {
                    linkPrecedence: "secondary",
                    linkedId: primaryContact.id,
                    updatedAt: new Date(),
                },
            });

            // any secondaries that were pointing to the downgraded primaries
            // now need to point to the true primary instead
            await tx.contact.updateMany({
                where: { linkedId: { in: primaryIdsToDowngrade } },
                data: {
                    linkedId: primaryContact.id,
                    updatedAt: new Date(),
                },
            });
        });

        console.log(
            `Downgraded contacts [${primaryIdsToDowngrade.join(", ")}] to secondary`
        );
    }

    // step 3: check if the incoming request has any NEW information
    // that are not already in the linked contact group.
    // if so, create a new secondary contact to capture it.
    const allLinkedContacts = await getAllLinkedContacts(primaryContact.id);

    const emailExists =
        !email || allLinkedContacts.some((c) => c.email === email);
    const phoneExists =
        !phoneNumber ||
        allLinkedContacts.some((c) => c.phoneNumber === phoneNumber);

    if (!emailExists || !phoneExists) {
        const newSecondary = await prisma.contact.create({
            data: {
                email: email || null,
                phoneNumber: phoneNumber || null,
                linkedId: primaryContact.id,
                linkPrecedence: "secondary",
            },
        });
        console.log(
            `Created new secondary contact (id: ${newSecondary.id}) linked to primary (id: ${primaryContact.id})`
        );

        // re-fetch to include the new secondary
        const updatedContacts = await getAllLinkedContacts(primaryContact.id);
        return buildResponse(primaryContact, updatedContacts);
    }

    return buildResponse(primaryContact, allLinkedContacts);
}

// helper: find contacts matching email OR phone

async function findMatchingContacts(
    email?: string | null,
    phoneNumber?: string | null
): Promise<Contact[]> {
    // build OR conditions for email and phone number
    const conditions: any[] = [];

    if (email) {
        conditions.push({ email });
    }
    if (phoneNumber) {
        conditions.push({ phoneNumber });
    }

    // if neither email nor phone is provided, return empty
    if (conditions.length === 0) return [];

    return prisma.contact.findMany({
        where: {
            OR: conditions,
            deletedAt: null,
        },
        orderBy: { createdAt: "asc" },
    });
}

// helper: get all contacts in a linked group

async function getAllLinkedContacts(primaryId: number): Promise<Contact[]> {
    // fetch the primary contact and all its secondaries
    return prisma.contact.findMany({
        where: {
            OR: [{ id: primaryId }, { linkedId: primaryId }],
            deletedAt: null,
        },
        orderBy: { createdAt: "asc" },
    });
}

// helper: build the API response

function buildResponse(
    primary: Contact,
    allContacts: Contact[]
): IdentifyResponse {
    // if allContacts is empty (brand new contact), just use the primary
    if (allContacts.length === 0) {
        allContacts = [primary];
    }

    // collect unique emails and phone numbers
    // primary's info always comes first
    const emails: string[] = [];
    const phoneNumbers: string[] = [];
    const secondaryContactIds: number[] = [];

    // add primary's info first
    if (primary.email) emails.push(primary.email);
    if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

    // then add info from secondaries (maintaining order by createdAt)
    for (const contact of allContacts) {
        if (contact.id === primary.id) continue; // skip primary, already added

        // track secondary IDs
        secondaryContactIds.push(contact.id);

        // add unique emails
        if (contact.email && !emails.includes(contact.email)) {
            emails.push(contact.email);
        }

        // add unique phone numbers
        if (contact.phoneNumber && !phoneNumbers.includes(contact.phoneNumber)) {
            phoneNumbers.push(contact.phoneNumber);
        }
    }

    return {
        contact: {
            primaryContactId: primary.id,
            emails,
            phoneNumbers,
            secondaryContactIds,
        },
    };
}
