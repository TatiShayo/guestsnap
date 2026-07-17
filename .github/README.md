# CI note

`ci.yml.disabled` is the CI workflow (typecheck + lint + build). It lives here
instead of `.github/workflows/` because the token used to publish this repo
lacked GitHub `workflow` scope. To re-enable CI:

    mv .github/ci.yml.disabled .github/workflows/ci.yml

then commit/push with a token that has `workflow` scope (or via the GitHub UI).
