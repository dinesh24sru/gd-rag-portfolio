# GitHub Actions workflows

CI/CD for the monorepo.

Expected pipelines (to be added):

* `ci.yml` — install, typecheck, test, lint
* `deploy-backend.yml` — SAM build/deploy for `infra` + services
* Frontend deploy remains on Vercel pointing at `apps/web`
