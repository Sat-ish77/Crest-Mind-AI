# Assignment 7 – Screenshot and Submission Checklist

This checklist is for CapCrest's assignment preparation. The user-facing submission is `user-manual.md` with its six screenshots in `images/`.

## 1. Prepare

1. Open https://v0-crestmind-frontend.vercel.app/ in Chrome or Edge.
2. Sign in normally with your name and the current shared password. Do not use Demo Mode for screenshots of upload or saved review records.
3. Use one readable browser appearance and a consistent window size. Close unrelated tabs or panels if they hide the app.
4. In VS Code, open the project root and the `images` folder. Save screenshots there using the exact filenames below.
5. Use only actual application screens. Do not generate or edit screenshots to show results that did not happen. Choose documents and passages approved for inclusion in your repository and course submission; remove identifying material from the selected view before capturing if necessary.

## 2. Capture six images

| Filename | Open this page and prepare this state | What must be visible |
|---|---|---|
| `images/library-upload.png` | Document Library: show the upload form. Select an approved PDF/DOCX and enter its property name and document type if appropriate. | File selection area, Property Name, Document Type, Upload Document. An unsubmitted form is fine; caption describes preparation. |
| `images/library-list.png` | Document Library: scroll to the existing populated library. If adding a new file, wait for actual upload completion first. | Real document rows and the relevant column headings. |
| `images/ask-question.png` | Ask a Question: enter a specific question and choose its document/type filters before searching. | Question field, selected filters, and Search. |
| `images/ask-answer-sources.png` | Submit that question. After the response arrives, select a source card or expand its citation. | Actual answer, confidence label, supporting passage, and source name/page or section. |
| `images/feedback-flag.png` | On an answer that needs review, open Flag Error and enter a factual explanation. | Flag form, note, and Submit Flag. Do not falsely flag a correct live answer just to obtain a screenshot. A form before submission documents the control, not successful storage. |
| `images/answer-review.png` | Answer Review: select All or Flagged, then expand an existing saved record. | Saved feedback action, question, reviewer note if present, original answer, and sources. Use an authorized existing record rather than inventing one. |

For Windows, use the Snipping Tool and save as PNG. For macOS, use the screenshot controls, then rename/move the PNG into `images/`. Capture the relevant application area large enough that labels and text are readable. You may use an existing screenshot of your own application if it accurately illustrates the current instructions.

If the service fails or there are no review records, do not replace them with mockups. Keep the manual marked incomplete, capture the real available interface, and resolve the missing evidence with the team/instructor. Two screenshots per major feature are required by the supplied rubric.

## 3. Check the manual

1. Confirm all six filenames exactly match the table, including `.png`. If you choose JPG, update the corresponding image reference in `user-manual.md` to `.jpg`.
2. Open `user-manual.md` in VS Code and press Ctrl+Shift+V to preview it.
3. Confirm each image renders, is readable, and illustrates the nearby steps.
4. Confirm the team contact email is the address you want property managers to use. Update it if your team has a designated support address.
5. Remove the preparation note near the top of the manual only after the screenshots are present and the document is ready.
6. Review for confidential data before publishing screenshots. Never include passwords or API keys.

## 4. Save the final screenshots to GitHub

The initial documentation commit may contain the written manual and this checklist before the six images are added. Finish the screenshot commit before submitting the repository link.

From the project root, stage only the six intended screenshots and the finalized manual:

```powershell
git add -- user-manual.md images/library-upload.png images/library-list.png images/ask-question.png images/ask-answer-sources.png images/feedback-flag.png images/answer-review.png
git diff --cached --stat
git commit -m "docs: add user manual screenshots"
git push origin main
```

Do not use `git add .`: other unrelated changes may be present. Use the normal repository author's identity unless a teammate actually authored the work and attribution is agreed.

## 5. Submit in Canvas

1. Open https://github.com/Sat-ish77/Crest-Mind-AI/blob/main/user-manual.md.
2. Confirm GitHub displays all six screenshots.
3. In Assignment 7, choose the repository-link option allowed by the assignment and submit that exact manual URL.
4. Open the submitted link to verify it works. Keep the submission confirmation.
5. If Canvas only accepts a file upload, follow the instructor's directions for supplying the required image folder as well; uploading a standalone Markdown file does not embed its relative images.

Do not submit a DOCX, PDF, or TXT replacement. The required deliverable is Markdown.
