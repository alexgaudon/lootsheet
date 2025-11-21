build: build-frontend build-backend
	rm -rf apps/backend/pb_public
	cp -r apps/frontend/dist apps/backend/pb_public

build-frontend:
	cd apps/frontend && bun run build

build-backend:
	cd apps/backend && go build -tags production

serve: build
	cd apps/backend && ./lootsheet serve

dev-frontend:
	cd apps/frontend && bun run dev

dev-backend:
	cd apps/backend && go run . serve

dev:
	bun run --cwd apps/frontend dev & \
	cd apps/backend && go run . serve

docker-build:
	docker build . -t lootsheet:latest