Yes. You can create an **agentic job-verification agent** that triages postings and tells you whether a job looks **real, stale, ghost-like, scam-like, or worth applying to**.

The important limitation: it cannot prove every job is real. It can assign a **confidence score** based on evidence: official company listing, recency, recruiter legitimacy, domain checks, duplicate postings, compensation transparency, application flow, scam signals, and evidence of actual hiring activity.

Below is a practical Hermes-based setup.

---

# Job Verification Agent Using Hermes

## 1. Recommended Agent Design

Name it something like:

> **RealJob Scout**

Its job is to take a job posting URL, recruiter message, or pasted job description and return:

```text
Verdict: Likely Real / Needs Verification / Likely Ghost / Likely Scam
Confidence: 0–100
Apply Priority: High / Medium / Low / Do Not Apply
Evidence Found:
- Official company careers page match
- Posting age
- Recruiter legitimacy
- Company domain match
- Scam indicators
- Duplicate/stale posting signals
Recommended Next Action:
- Apply directly
- Message hiring manager
- Avoid
- Verify with company HR
```

Hermes is a good fit because Hermes Agent supports tool use, web control, persistent memory, scheduled automations, skills, and MCP integrations. Its docs describe it as an autonomous agent with memory, skills, scheduled automations, web/search/browser tools, and the ability to run through CLI or messaging platforms. ([Hermes Agent][1])

---

# 2. What the Agent Should Check

## Core Verification Checks

Your agent should inspect each job against these signals:

| Category              | What to Check                                                                    | Why It Matters                               |
| --------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| Official source       | Is the job on the company’s careers page?                                        | Highest signal that it is real               |
| Posting age           | Was it posted recently or refreshed endlessly?                                   | Old/recycled posts may be ghost jobs         |
| Company identity      | Does the company website, LinkedIn, and domain match?                            | Prevents impersonation                       |
| Recruiter identity    | Does the recruiter use a corporate email and real profile?                       | Scammers often use fake recruiter identities |
| Application URL       | Does the apply link go to the employer, Greenhouse, Lever, Workday, Ashby, etc.? | Random forms are suspicious                  |
| Contact method        | Are they pushing Telegram, WhatsApp, text-only, or crypto/task work?             | Common scam signal                           |
| Money request         | Do they ask you to pay for equipment, training, or checks?                       | Major scam signal                            |
| Personal data request | Do they ask for SSN, bank info, ID too early?                                    | Major identity theft risk                    |
| Duplicate listings    | Same job copied across many boards with inconsistent details                     | Possible scraper or fake post                |
| Hiring signal         | Does company show recent funding, grants, expansion, or team growth?             | Higher probability of real need              |

The FTC specifically warns that many job scams try to steal money or personal information, and its job-scam guidance includes fake recruiters, task scams, work-from-home scams, and suspicious job offers as recurring patterns. ([Consumer Advice][2])

---

# 3. Software Requirements

## Minimum Setup

You need:

```text
Computer:
- macOS, Windows, Linux, or WSL2

Core software:
- Hermes Agent
- Python 3.11+
- Git
- Docker Desktop recommended
- Browser access or Hermes browser/web tools

Accounts/API access:
- Nous Portal, OpenRouter, OpenAI, Anthropic, Gemini, or another supported model provider
- Web search backend: Firecrawl, Tavily, Exa, SearXNG, or similar
- Optional: Google Sheets/Airtable/Notion for tracking
- Optional: Gmail/LinkedIn/Slack integrations for outreach workflows
```

Hermes stores configuration under `~/.hermes/`, including `config.yaml`, `.env`, `SOUL.md`, memories, skills, cron jobs, sessions, and logs. ([Hermes Agent][3])

## Recommended Setup

Use Docker for safety.

Hermes supports multiple terminal backends, including local, Docker, SSH, Modal, Daytona, and Singularity. The docs describe Docker as a stronger isolation option than local execution, while local mode runs commands directly on your machine. ([Hermes Agent][3])

For a job-verification agent that browses links, parses pages, and may run scripts, I would use:

```yaml
terminal:
  backend: docker
  cwd: "."
  timeout: 180
  home_mode: auto
```

Why Docker? Because you do not want an autonomous agent running arbitrary page-parsing scripts directly on your personal machine if you can avoid it.

---

# 4. Hermes Installation

## macOS / Linux / WSL2

Hermes provides a command-line installer:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```

## Windows Native

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

Hermes also provides a Desktop installer for Windows and macOS, and the docs state that `hermes setup --portal` is the fastest path because one OAuth flow can configure a model provider plus Tool Gateway tools. ([Hermes Agent][1])

After install:

```bash
hermes setup --portal
hermes config check
hermes config edit
```

---

# 5. Hermes Configuration

Open the config:

```bash
hermes config edit
```

Use a structure like this:

```yaml
terminal:
  backend: docker
  cwd: "."
  timeout: 240
  home_mode: auto

web:
  backend: tavily
  search_backend: tavily
  extract_backend: firecrawl

agent:
  max_iterations: 60
  api_max_retries: 2

auxiliary:
  web_extract:
    provider: auto
    model: ""
    timeout: 360

  mcp:
    provider: auto
    model: ""
    timeout: 120

updates:
  pre_update_backup: true
  backup_keep: 5
  non_interactive_local_changes: stash
```

Hermes supports configuring web search and extraction backends under the `web:` block, including Firecrawl, SearXNG, Parallel, Tavily, and Exa. ([Hermes Agent][3])

---

# 6. Environment Variables

Create or edit:

```bash
nano ~/.hermes/.env
```

Example:

```bash
TAVILY_API_KEY=your_key_here
FIRECRAWL_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
```

Use only the services you actually plan to use.

---

# 7. Create the Agent Identity

Edit:

```bash
nano ~/.hermes/SOUL.md
```

Use this:

```markdown
# RealJob Scout

You are RealJob Scout, an agent that helps job seekers avoid fake, stale, ghost, and scam job postings.

Your job is to verify job opportunities using evidence, not vibes.

## Primary Goals

1. Determine whether a job posting appears real.
2. Detect scam signals.
3. Detect ghost-job or stale-posting signals.
4. Recommend whether the user should apply, verify, ignore, or escalate.
5. Prefer official employer sources over third-party boards.
6. Never tell the user a job is definitely real unless there is strong evidence.

## Required Output Format

For every job, return:

- Verdict: Likely Real / Needs Verification / Likely Ghost / Likely Scam / Insufficient Evidence
- Confidence Score: 0–100
- Apply Priority: High / Medium / Low / Do Not Apply
- Evidence Summary
- Red Flags
- Missing Evidence
- Recommended Next Step
- Suggested Outreach Message, if useful

## Verification Rules

A job is high-confidence only if:
- It appears on the employer’s official careers page or trusted ATS page.
- The company domain matches the employer identity.
- The job title, location, and description are consistent across sources.
- The application URL is legitimate.
- No payment, crypto, check-deposit, or informal messaging red flags appear.

A job is suspicious if:
- The recruiter uses a free email domain.
- The offer arrives through text, WhatsApp, Telegram, or social media without prior application.
- The job promises unusually high pay for vague work.
- The employer asks for money, banking info, identity documents, or equipment purchases early.
- The job cannot be found on the company’s official site.
- The posting is old, repeatedly reposted, or appears on many scraped boards with inconsistent details.

## Behavior

Be skeptical, evidence-driven, and concise.
Do not overstate certainty.
When evidence is missing, say exactly what is missing.
Protect the user from scams.
```

---

# 8. Create a Job Verification Skill

Hermes has a skills system and stores skills under `~/.hermes/skills/`. Its docs describe skills as reusable procedural memory that the agent can create and reuse. ([Hermes Agent][1])

Create:

```bash
mkdir -p ~/.hermes/skills/job-verification
nano ~/.hermes/skills/job-verification/SKILL.md
```

Paste this:

```markdown
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

Subtract:
- -30 if not found on official company site
- -40 if money/payment/check deposit is requested
- -35 if recruiter uses free email or suspicious domain
- -25 if application link is suspicious
- -20 if posting is older than 60 days
- -20 if description is vague or copied
- -20 if communication is pushed to WhatsApp, Telegram, or text only
- -50 if identity theft indicators appear

## Verdict

90–100: Very Likely Real
75–89: Likely Real
55–74: Needs Verification
35–54: Low Confidence / Possible Ghost
0–34: Likely Scam or Not Worth Applying

## Output Format

Return:

Verdict:
Confidence Score:
Apply Priority:
Evidence Found:
Red Flags:
Missing Evidence:
Recommended Next Step:
Suggested Outreach Message:
```

---

# 9. Optional: Add a Structured JSON Output Mode

For tracking jobs in a spreadsheet, have the agent output JSON too:

```json
{
  "company": "",
  "job_title": "",
  "source_url": "",
  "official_company_listing_found": true,
  "ats_domain": "",
  "posting_age_days": null,
  "recruiter_verified": false,
  "scam_flags": [],
  "ghost_flags": [],
  "confidence_score": 0,
  "verdict": "",
  "apply_priority": "",
  "recommended_next_action": ""
}
```

This makes it easier to store results in Google Sheets, Airtable, Notion, or a local SQLite database.

---

# 10. Suggested Folder Structure

Create a workspace:

```bash
mkdir -p ~/realjob-scout/{inputs,outputs,scripts,data}
cd ~/realjob-scout
```

Recommended structure:

```text
realjob-scout/
├── inputs/
│   └── jobs_to_check.csv
├── outputs/
│   └── verified_jobs.csv
├── scripts/
│   ├── verify_job.py
│   └── score_job.py
├── data/
│   ├── trusted_ats_domains.txt
│   ├── scam_patterns.txt
│   └── company_cache.json
└── README.md
```

---

# 11. Trusted ATS Domain List

Create:

```bash
nano ~/realjob-scout/data/trusted_ats_domains.txt
```

Add:

```text
greenhouse.io
lever.co
myworkdayjobs.com
workdayjobs.com
ashbyhq.com
smartrecruiters.com
icims.com
jobvite.com
bamboohr.com
paylocity.com
successfactors.com
oraclecloud.com
adp.com
workable.com
recruitee.com
comeet.com
rippling.com
```

Important: a trusted ATS domain is not automatic proof. Scammers can still redirect or impersonate brands. The agent should check whether the ATS page is linked from the company’s official site.

---

# 12. Scam Pattern List

Create:

```bash
nano ~/realjob-scout/data/scam_patterns.txt
```

Add:

```text
pay for equipment
send money
deposit this check
wire transfer
crypto wallet
bitcoin
gift cards
telegram interview
whatsapp interview
signal interview
reshipping
package inspector
quality control manager
task optimization
app optimization
review products for pay
too good to be true
no interview required
urgent hiring
kindly provide your bank
send your ssn
send front and back of id
```

These patterns are aligned with common FTC-described job scam categories, including fake job offers, task scams, work-from-home scams, and attempts to steal money or personal information. ([Consumer Advice][2])

---

# 13. Example Hermes Prompt to Run the Agent

Once Hermes is installed and configured, you can ask:

```text
Use the Job Verification Skill.

Check this job posting:
[paste URL]

Return:
1. Verdict
2. Confidence score
3. Evidence found
4. Scam or ghost-job red flags
5. Whether I should apply
6. Best next action
```

For batch checking:

```text
Use the Job Verification Skill.

Read ~/realjob-scout/inputs/jobs_to_check.csv.
For each job, verify whether it appears real.
Write results to ~/realjob-scout/outputs/verified_jobs.csv.

Columns:
company, job_title, source_url, official_listing_found, ats_domain, confidence_score, verdict, apply_priority, red_flags, recommended_next_action
```

---

# 14. CSV Input Format

Create:

```bash
nano ~/realjob-scout/inputs/jobs_to_check.csv
```

Example:

```csv
company,job_title,source_url,notes
Acme Inc,Program Manager,https://example.com/job123,Found on LinkedIn
Beta Org,Operations Manager,https://example.com/job456,Recruiter emailed me
```

---

# 15. Stronger Architecture: Multi-Agent Setup

A better version uses multiple specialized subagents:

## Agent 1: Source Verifier

Checks:

```text
- Is this job on the official company site?
- Is the ATS domain legitimate?
- Does the URL chain look safe?
```

## Agent 2: Scam Detector

Checks:

```text
- Payment requests
- Fake recruiter signs
- Identity theft signs
- Messaging-app pressure
- Too-good-to-be-true compensation
```

## Agent 3: Ghost Job Detector

Checks:

```text
- Posting age
- Reposting pattern
- Duplicate listings
- Company hiring signal
- Role specificity
```

## Agent 4: Application Strategist

Decides:

```text
- Apply directly?
- Contact recruiter?
- Contact hiring manager?
- Skip?
- Save for later?
```

Hermes supports delegation and parallelization through subagents, according to its feature list, so this structure fits the platform well. ([Hermes Agent][1])

---

# 16. Recommended Scoring Configuration

Use this as your main scoring model:

```yaml
realjob_scout:
  score_start: 50

  positive_signals:
    official_company_listing: 25
    trusted_ats_from_company_site: 15
    posted_under_14_days: 10
    recruiter_verified: 10
    specific_salary_and_scope: 10
    company_growth_signal: 10
    multiple_related_openings: 5

  negative_signals:
    not_on_company_site: -30
    asks_for_money: -40
    suspicious_recruiter_email: -35
    suspicious_application_url: -25
    older_than_60_days: -20
    vague_description: -20
    text_only_interview: -20
    identity_theft_request: -50
    reshipping_or_task_scam: -50

  verdicts:
    very_likely_real: 90
    likely_real: 75
    needs_verification: 55
    possible_ghost: 35
    likely_scam: 0
```

---

# 17. Recommended Output Template

Use this exact output:

```markdown
# Job Verification Report

## Verdict
Likely Real / Needs Verification / Possible Ghost / Likely Scam

## Confidence Score
82/100

## Apply Priority
High / Medium / Low / Do Not Apply

## Evidence Found
- Official company listing:
- ATS/application domain:
- Posting freshness:
- Recruiter identity:
- Company hiring signal:

## Red Flags
- 

## Missing Evidence
- 

## Recommended Next Action
Apply directly through the company website and send a short message to the hiring manager.

## Suggested Outreach Message
Hi [Name], I applied for the [Role] position and wanted to briefly introduce myself...
```

---

# 18. Best Practical Configuration

For your use case, I would configure Hermes like this:

```text
Model:
- Strong reasoning model for final judgment
- Cheaper/faster model for extraction and summarization

Tools:
- Web search
- Web extraction
- Browser
- Local file access
- Optional spreadsheet/Notion integration

Execution:
- Docker backend
- 180–360 second timeout
- Persistent job database

Memory:
- Remember trusted companies
- Remember confirmed scam domains
- Remember roles you are targeting
- Remember your resume keywords and preferred locations

Automation:
- Daily check of saved job boards
- Weekly summary of high-confidence jobs
- Alert only when confidence score is above threshold
```

Hermes supports scheduled automations, persistent memory, web tools, skills, and multiple messaging platforms, so you could run this from CLI, desktop, Telegram, Slack, or another supported gateway. ([Hermes Agent][1])

---

# 19. My Recommendation

Build it in this order:

1. **Start simple**: single Hermes skill that checks one job URL at a time.
2. **Add scoring**: use the 100-point system above.
3. **Add batch mode**: CSV in, CSV out.
4. **Add memory**: trusted companies, suspicious domains, recruiter names.
5. **Add automation**: daily scan for high-confidence roles.
6. **Add outreach**: generate recruiter/hiring-manager messages only for jobs scoring 75+.

Do **not** start with a fully autonomous “apply to jobs for me” agent. That is risky. Start with a **verification and prioritization agent**. Let it tell you where to spend human effort. That will save time without putting your identity, résumé, or applications on autopilot.

[1]: https://hermes-agent.nousresearch.com/docs/ "Hermes Agent Documentation | Hermes Agent"
[2]: https://consumer.ftc.gov/all-scams/job-scams "Job Scams | Consumer Advice"
[3]: https://hermes-agent.nousresearch.com/docs/user-guide/configuration/ "Configuration | Hermes Agent"
