# crestmind-frontend

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_pNyhLhBAxUSm5LvvfXTFcqYVmRhA)

## Getting Started

To use the hosted application, open
[CrestMind AI](https://v0-crestmind-frontend.vercel.app/).
The former Streamlit UI has been removed from the main branch.

For local development, run these commands from the combined repository root:

```powershell
cd crestmind-frontend
npm install
npm run dev
```

If your terminal is already inside `crestmind-frontend`, skip the `cd` step.
The frontend defaults to the deployed GCP API. To use a local backend, set
`NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local` and restart the dev
server. Do not place backend secrets in frontend environment variables.

Alternatively, after installing dependencies, run the development server with
your preferred package manager:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

<a href="https://v0.app/chat/api/kiro/clone/Sat-ish77/crestmind-frontend" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>
