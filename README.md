# NoteDeck for browsers

Post what you are reading to Misskey through [NoteDeck](https://github.com/notedeck-dev/notedeck) (a Misskey client, "Misskey Pro"), and open Misskey notes and users in NoteDeck instead of the web UI. Chromium browsers (Chrome / Edge / Brave / Vivaldi / Arc), Manifest V3. NoteDeck has to be installed on the same machine; it is launched when a `notedeck://` link is opened.

## What it does

| Where | What | Needs |
| --- | --- | --- |
| Right-click on a page / selection / link / image | **Post … via NoteDeck**: opens NoteDeck's post form with the title and URL (or the selection, or the link / image URL) filled in. Sending is up to you | nothing |
| Right-click on a Misskey note link (`https://host/notes/<id>`) or on such a page | **Open in NoteDeck**: opens the note window in NoteDeck | nothing |
| Right-click on a Misskey user link (`https://host/@user`) or on such a page | **Open in NoteDeck**: opens the user window. The username is resolved to an id through NoteDeck's API | token (`account.read`, on by default) |
| Toolbar button | Edit the text (page title + URL, or the selection), then **Open post form** (no token) or **Post** directly with account / visibility / CW. Direct posts are confirmed inside the NoteDeck window | token + `notes.write` for direct posting |
| Address bar `nd <text>` | Open the post form with the text | nothing |
| Alt+Shift+N (configurable at `chrome://extensions/shortcuts`) | Open the post form with the current page | nothing |

Everything marked "nothing" uses `notedeck://` deep links: no token, no permission, no confirmation dialog, because you are the one clicking.

## Setup

1. Load the extension (see Install). The context menus and the post form work right away.
2. For direct posting and for opening users, issue a token in NoteDeck under **Settings → Permissions → API tokens**, name it `browser`, and paste it into the extension's options. External tools get a read-only permission set by default; allow `notes.write` under the **External** principal if you want to post directly.
3. If you changed NoteDeck's HTTP API port, or run a development build (different port), set the API URL in the options.

## Install

Not in the Chrome Web Store yet. Load it unpacked:

1. Clone this repository (or download and unzip a release).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the repository folder (the one with `manifest.json`).

There is no build step; the files in `src/` run as they are.

## Development

```sh
npm install
npm run lint    # biome
npm test        # vitest (URL parsing, deep links, compose text)
npm run pack    # dist/notedeck-browser-<version>.zip for the store / releases
```

The extension only talks to NoteDeck's local endpoints: `POST /api/capabilities/{id}/execute` for `account.list`, `notes.create` and `user.lookup`, plus `notedeck://` links. Nothing is sent anywhere else. Deep links are opened by setting `location.href` in the current tab (the page stays), with a new tab as fallback on pages that cannot be scripted.

### Known limits

- `host_permissions` covers `127.0.0.1` and `localhost` on any port, so a development build of NoteDeck works by changing the API URL.
- Firefox is not targeted yet. The manifest is MV3 and should mostly carry over (`browser.*` namespace, `background.scripts` instead of `service_worker`).

## Relationship to NoteDeck's other integrations

Same shape as the [Raycast extension](https://github.com/notedeck-dev/notedeck-raycast), the [Stream Deck plugin](https://github.com/notedeck-dev/notedeck-streamdeck) and the [Obsidian plugin](https://github.com/notedeck-dev/notedeck-obsidian): a thin client of NoteDeck's HTTP API and `notedeck://` links, with nothing added to NoteDeck itself.

## License

MIT. NoteDeck itself is AGPL-3.0; this extension is a separate client of its public API.
