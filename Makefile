.PHONY: help up down logs restart backup-db restore-db rebuild

# Default environment file
ENV_FILE := .env.docker

help: ## Show this help message
	@echo "Usage: make [command]"
	@echo ""
	@echo "Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

up: ## Start all Docker services in the background
	docker compose --env-file $(ENV_FILE) up -d

down: ## Stop and remove all Docker services
	docker compose down

logs: ## View logs from all services (use Ctrl+C to exit)
	docker compose logs -f

restart: ## Restart all services
	docker compose restart

rebuild: ## Force rebuild and start all services
	docker compose --env-file $(ENV_FILE) up -d --build

backup-db: ## Backup the PostgreSQL database to backup.sql
	docker compose exec postgres pg_dump -U postgres postgres > backup.sql
	@echo "Database backed up to backup.sql"

restore-db: ## Restore the PostgreSQL database from backup.sql
	@if [ -f backup.sql ]; then \
		cat backup.sql | docker compose exec -T postgres psql -U postgres postgres; \
		echo "Database restored from backup.sql"; \
	else \
		echo "Error: backup.sql not found"; \
	fi
