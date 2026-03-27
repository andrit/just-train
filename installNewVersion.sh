# can you write me a shell script that will run these commands



# cp ./.env trainer-app-v1.5.0/apps/backend/.env

# pnpm install && pnpm approve-builds && pnpm lint && pnpm typecheck && pnpm dev

# after pnpm approve-builds it will prompt 'Choose which packages to build '
# choose argon2 and esbuild and continue, then it will ask 'Do you approve?', enter 'y' to confirm

#!/bin/zsh

cp ./.env trainer-app-v1.5.0/apps/backend/.env

pnpm install && pnpm approve-builds && pnpm lint && pnpm typecheck && pnpm dev