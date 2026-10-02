# Optional local helper. SAM packages `services/api/dist` after `npm run build:api`.

build-ApiFunction:
	node ./scripts/build-api.mjs
	cp -r services/api/dist/* $(ARTIFACTS_DIR)/
