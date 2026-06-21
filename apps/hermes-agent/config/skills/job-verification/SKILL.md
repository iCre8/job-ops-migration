# Job Verification Skill

Use this skill whenever the user provides a job posting URL, recruiter message, job board listing, company name, or job description and asks whether the opportunity is real, fake, stale, scam-like, or worth applying to.

## Workflow

1. Extract the following:
   - Job title
   - Company name
   - Location
   - Remote/hybrid/on-site status
   - Salary range
   - Recruiter name
   - Recruiter email/domain
   - Application URL
   - Source platform
   - Date posted, if available

2. Verify official source:
   - Search the company’s official careers page.
   - Search the exact job title plus company name.
   - Check whether the job appears on a legitimate ATS domain such as Workday, Greenhouse, Lever, Ashby, SmartRecruiters, iCIMS, or the company’s own domain.
   - If the job appears only on third-party boards, lower confidence.

3. Check identity and domain:
   - Compare company website domain against recruiter email domain.
   - Flag free email domains for recruiter communication.
   - Flag misspelled domains or suspicious subdomains.
   - Flag shortened links unless expanded safely.

4. Check posting freshness:
   - Look for date posted.
   - If older than 45 days, mark as potentially stale.
   - If older than 90 days, mark as likely stale unless evidence shows active hiring.
   - If reposted repeatedly, mark as possible ghost job.

5. Check scam signals:
   - Money requested from candidate.
   - Check deposit or equipment purchase.
   - Crypto, gift card, task optimization, package reshipping, or rating/review work.
   - Requests for SSN, bank info, or ID before formal offer.
   - Interview only through chat/text.
   - High pay for vague work.
   - Pressure or urgency.

6. Check hiring signal:
   - Look for company growth, funding, new grants, new contracts, multiple related openings, recent recruiter activity, or employees discussing hiring.
   - If no hiring signal exists, do not mark fake automatically; mark evidence incomplete.

7. Score the job.

## Scoring

Start at 50.

Add:
- +25 if found on official company careers page
- +15 if found on known ATS connected from company site
- +10 if posted within last 14 days
- +10 if recruiter identity appears legitimate
- +10 if salary, role scope, and location are specific
- +10 if company shows recent hiring/growth signal
- +5 if multiple related openings are found

Subtract:
- -30 if not found on official company site
- -40 if money/payment/check deposit is requested
- -35 if recruiter uses free email or suspicious domain
- -25 if application link is suspicious
- -20 if posting is older than 60 days
- -20 if description is vague or copied
- -20 if communication is pushed to WhatsApp, Telegram, or text only
- -50 if identity theft indicators appear
- -50 if reshipping or task scam indicators appear

## Verdict

90–100: Very Likely Real
75–89: Likely Real
55–74: Needs Verification
35–54: Low Confidence / Possible Ghost
0–34: Likely Scam or Not Worth Applying

## Output Format

Your final response MUST conclude with a valid JSON block containing the structured evaluation details, enclosed in a ```json markdown block:

```json
{
  "verdict": "likely_real | needs_verification | possible_ghost | likely_scam | insufficient_evidence",
  "confidenceScore": 0-100,
  "applyPriority": "high | medium | low | do_not_apply",
  "evidence": ["evidence item 1", "evidence item 2"],
  "redFlags": ["red flag 1", "red flag 2"],
  "missingEvidence": ["missing evidence 1"],
  "recommendedNextStep": "description of recommended action",
  "outreachMessage": "suggested template or null"
}
```
Ensure all fields are fully filled out.
