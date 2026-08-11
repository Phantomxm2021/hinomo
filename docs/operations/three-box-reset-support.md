# Three-Box Reset support and follow-up playbook

## Guardrails and operating limits

- Do not contact a user without verified contact opt-in. Before sending any outbound template, confirm that optional signup contact consent is recorded. A user may still receive a direct reply in the support thread they initiated.
- Never paste email addresses or household content into PostHog. Do not put household photos, item names, search terms, QR contents, or payment details in PostHog or another analytics event.
- Record feedback only as an anonymized theme, severity, lifecycle stage, and whether it blocks activation. Do not add a name, email address, household content, payment details, or a transcript to that record.
- Reply to support messages within 48 hours. Guide no more than five users simultaneously; if five are already being guided, offer asynchronous support or a later time.
- For payment or AI-recognition support, ask only for the identifiers and timing below. Never request card numbers, payment-method details, household photos, or other household content by email.

## Ready-to-send templates

### D0 — welcome and quick start

Send only to a user with verified contact opt-in.

> Welcome to Nomo’s Three-Box Reset. To get started:
>
> 1. Create one space for the area you are resetting.
> 2. Add one box and give it a simple label.
> 3. Add one real item to that box, then save it.
>
> Reply to this message if you want help with any step.

### D2 — stalled user

Send only to a user with verified contact opt-in.

> Where did you get stuck in the Three-Box Reset?

### D7 — value test

Send only to a user with verified contact opt-in.

> Could you try two quick checks today: search for one item you packed, and scan one label? Reply with whether each one helped you find the right box.

### D7–10 — founder offer

Send once, only after the user has demonstrated product value and only with verified contact opt-in. Do not add deadlines, inventory claims, or other scarcity language.

> If Nomo is helping you keep track of your boxes, you can choose the founder offer: US$9 once for unlimited boxes plus 20 Credits. There is no deadline or limited-quantity claim—this is simply an optional one-time purchase. Reply if you have a question before deciding.

### Payment issue acknowledgement

> Thanks for letting us know. Please send the Checkout Session ID from the payment confirmation or return page so we can look up the order. Do not send card numbers, payment-method details, screenshots containing them, or other payment details.

### AI recognition issue acknowledgement

> Thanks for reporting this. Please tell us which box you were working in and approximately when the recognition session started or failed (including your time zone if you can). Do not email household photos; we only need the box and session timing to investigate.

## 15-minute interview script

Use only with a participant who agreed to the conversation. Keep the notes anonymous and reduce them to the permitted feedback fields after the call.

1. What triggered you to organize these boxes or this area now?
2. Before Nomo, what method did you use to remember where things were?
3. What, if anything, made the initial setup feel difficult or slow?
4. Tell me about the moment you tried to find something again—what worked or did not work?
5. Based on that experience, would you pay for Nomo, and what would make the price feel worthwhile or not worthwhile?

## Feedback record format

Record one row per theme, with no direct identifiers or content:

| Anonymized theme | Severity | Lifecycle stage | Blocks activation? |
| --- | --- | --- | --- |
| Example: unclear first-box label | low / medium / high | signup / first space / first box / first item / find-back / checkout | yes / no |
