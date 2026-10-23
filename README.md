# CAT SG — Casual SG Advanced Tournament tracker

Live schedule, scores, standings and knockouts for CAT SG 2.0, hosted by Casual SG.
14 teams, 2v2, two pools of 7 (Pool A from 4:00 PM, Pool B from 5:30 PM), then semi-finals and the final.
Every game is first to 15, no deuce.

Tabs: **CAT SG 2.0** (live), **Previous** (CAT SG 1.0, read only), **Gallery**, **Rules** (FIVB beach rules with
animated pictures) and **Tournament rules**. Each tab is a link: `#cat2`, `#previous`, `#gallery`, `#rules`, `#tournament-rules`.

Website: https://mikachufm2202.github.io/tourney-tracker/

## What is in this folder

| File | What it is |
| --- | --- |
| `index.html` | The whole website: page, styles and logic in one file. |
| `scores-cat2.json` | The saved CAT SG 2.0 scores. Admins write this file. |
| `scores.json` | The final CAT SG 1.0 scores (read only now). |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |
| `.github/workflows/pages.yml` | Publishes the website after every push and every score save. |
| `og.png` | The preview picture shown when the link is shared in WhatsApp, Telegram and similar apps. |
| `icon.png` | Browser tab and phone home-screen icon (the club logo). |
| `assets/` | Club logo, the spinning Mikasa ball (CAT SG 2.0) and Yatha (CAT SG 1.0), and `gallery/` photos and video. |

## How live scores work

1. Everyone opens the website and picks **Viewer**. The page re-reads `scores.json` every 20 seconds.
2. An admin picks **Admin** and types the admin password. The password only hides the admin screen.
3. The admin types both scores for a game and taps **Save scores**.
4. Saving commits a new `scores.json` to this repository through the GitHub API.
5. The publish workflow republishes the site, and viewers see the new scores within about a minute.
   A workflow is used because the classic GitHub Pages build is limited to about 10 builds per hour.

Standings, semi-final teams (1st vs 4th, 2nd vs 3rd), the 3rd place game and the final are worked out
from `scores.json` every time the page loads. They are never stored separately, so a corrected score
always flows through.

## One-time setup for each admin device

Saving needs a GitHub token. The token is typed into the admin screen once and is kept on that
device only. It is never stored in this repository.

1. On GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
2. Repository access: **Only select repositories** → `tourney-tracker`.
3. Permissions → Repository permissions → **Contents: Read and write**.
4. Set a short expiry (for example 7 days), generate, and copy the token.
5. Open the website, pick Admin, type the password, paste the token, tap **Save token**.

Share the token privately with any other admin. Delete the token on GitHub after the tournament.

## Testing, then starting clean

1. On an admin device, type a score for game 1 and tap **Save scores**.
2. Open the website on another phone. The score shows within about a minute.
3. Back on the admin device, scroll to the bottom and tap **Reset scores**.
4. Read the warning, type the organiser password, and tap **Reset all scores**. Every score is deleted for everyone.

The organiser password is the same as the admin password.

## Rules built into the page

- Ranking: wins (a draw counts as half a win), then point difference, then points scored, then the result between the two teams when exactly two are level.
- Scores are whole numbers from 0 to 99. A knockout game cannot be level.
- A knockout score only counts for the two teams it was saved against. If a correction changes who is in that game, the admin is asked to enter the score again.
- If two admins save at the same moment, the second save is placed on top of the first. Nothing is overwritten.
- "On court now" follows the clock in Singapore time, so it moves to the next slot by itself.
- If a phone loses signal, a red "No connection" strip shows under the top bar until the next successful check.
- A link that ends in a section name opens straight at that section, for example `#schedule`, `#standings` or `#bracket`.

## Admins, blackouts and withdrawals

- Admins are Yatha, Sat, Ash and Mika (`ADMINS` in `index.html`). An admin picks their name and types the password;
  each save is committed as "... by <name>".
- **Black out** on a pool game marks it as not played. It counts for nobody.
- **Mark withdrawn** (bottom of the admin screen) blacks out every unfinished game of a team that is absent or left
  early, and drops it to the bottom of its pool so it cannot be seeded into the semi-finals.

## Changing the tournament

CAT SG 2.0 is the `CAT2` object near the top of the script in `index.html`: teams are `POOL_A` and `POOL_B`,
the schedule is generated round by round from them. CAT SG 1.0 is `CAT1`.
The sponsor goes in `SPONSOR` (logo file in `assets/`). Gallery photos are listed in `GALLERY`.
The repository name and owner are in `CFG` in the same file.
