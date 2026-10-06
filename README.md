# AI Playbook for small businesses

A plain-language guide to using AI tools safely in a small business with no IT staff: nine steps, a quick check of about 10 minutes, and tools that turn your answers into a list of the AI you use, a risk overview, a one-page AI policy and a record you can share. Two ways through: the essentials in under an hour, or the full playbook, with a progress page that shows what is done and what to do next.

**The site:** https://sumnerkirby.github.io/AI-Playbook/

## Status

Educational material, not legal advice. Points marked check with an advisor should be confirmed with one.

## Privacy

Nothing you enter is sent to us or to anyone else. There are no accounts and no analytics, and the pages load nothing from other sites (the fonts are part of the site). Answers stay in this browser, and in the page address when you choose to save or share a link; the quick check keeps its answers in the address as you go, so they also appear in your browser history. The site's host, GitHub Pages, receives ordinary page requests, as it would for any website.

Every page carries a Content-Security-Policy that stops its scripts from connecting to any server, so the browser enforces this. The [privacy page](https://sumnerkirby.github.io/AI-Playbook/privacy.html) lists everything the site saves, under which key and for how long, and has one button that deletes all of it.

## Sources

The steps quote, word for word, the NIST AI Risk Management Framework (AI RMF 1.0), its Playbook and its Generative AI Profile, which are US government publications, and the OWASP Top 10 for LLM Applications 2026, quoted under CC BY-SA 4.0 and credited on each page. This site is not a publication of NIST or OWASP and is not endorsed by either; the original publications are authoritative.

## Fonts

Archivo, IBM Plex Mono and Source Serif 4, under the SIL Open Font License. The license files are in `fonts/`.

## Tests

The rules are tested. Open `tests/run_tests.html` on the site to run the tests in your browser, or run `tests/run_tests.sh` on a Mac. The privacy tests read the site's own files, so in a browser they work only on the site, not from a copy opened from disk.

## License

Copyright 2026 The AI Playbook Project, University of Oklahoma Cybersecurity Clinic. Different parts of the site are under different terms:

| What | License |
|---|---|
| Code: the JavaScript, CSS, page markup and tests | [MIT](LICENSE) |
| Writing: the playbook, guides and other text on the site | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): reuse and adapt it, with credit to the AI Playbook Project |
| Templates: the policy templates (`policy-*.html`), the starter acceptable use policy in the AI policy guide, and the policy text the AI policy tool writes | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): copy them into your own documents with no credit needed |
| Passages from the OWASP Top 10 for LLM Applications 2026, including the condensed page `owasp-llm-top-10-2026.html` | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), from the OWASP Foundation, as credited on each page |
| Passages from NIST publications, including the NIST library pages | US government works, not covered by the licenses above |
| Fonts | SIL Open Font License (see `fonts/`) |

Documents you make with the site's tools, such as your policy or your record, are yours.

## Contact

To report a problem, suggest a correction or ask a question, email the University of Oklahoma Cybersecurity Clinic at [cyberclinic@ou.edu](mailto:cyberclinic@ou.edu), or [open an issue](https://github.com/sumnerkirby/AI-Playbook/issues) on GitHub. Issues are public, so do not include anything about your business that you would not want others to read.
