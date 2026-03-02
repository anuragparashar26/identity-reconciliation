// routes for the Identity Reconciliation API
// POST /identify - the main endpoint that handles contact identification and linking logic.

import { Router, Request, Response } from "express";
import { identify } from "./service";

const router = Router();

// POST /identify
// accepts an email and/or phone number and returns the consolidated contact information, linking contacts as needed.

router.post("/identify", async (req: Request, res: Response) => {
    try {
        const { email, phoneNumber } = req.body;

        // input validation 
        // at least one of email or phoneNumber must be provided
        if (!email && !phoneNumber) {
            return res.status(400).json({
                error:
                    "At least one of 'email' or 'phoneNumber' must be provided.",
            });
        }

        // basic type checks
        if (email && typeof email !== "string") {
            return res.status(400).json({
                error: "'email' must be a string.",
            });
        }

        if (phoneNumber && typeof phoneNumber !== "string") {
            return res.status(400).json({
                error: "'phoneNumber' must be a string.",
            });
        }

        // run the identity reconciliation logic
        const result = await identify({ email, phoneNumber });

        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in /identify:", error);
        return res.status(500).json({
            error: "Something went wrong. Please try again later.",
        });
    }
});

export default router;
