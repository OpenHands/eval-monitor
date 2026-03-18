SHELL := /usr/bin/env bash
.SHELLFLAGS := -c

# Colors for output
ECHO := printf '%b\n'
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
CYAN := \033[36m
UNDERLINE := \033[4m
RESET := \033[0m

# Project paths
FRONTEND_DIR := frontend

.PHONY: help install dev build test lint format clean preview check-deps

# Default target
.DEFAULT_GOAL := help

# Show help
help:
	@$(ECHO) "$(CYAN)Eval Monitor Makefile$(RESET)"
	@$(ECHO) ""
	@$(ECHO) "$(UNDERLINE)Usage:$(RESET) make <command>"
	@$(ECHO) ""
	@$(ECHO) "$(UNDERLINE)Development Commands:$(RESET)"
	@$(ECHO) "  $(GREEN)install$(RESET)       Install all dependencies"
	@$(ECHO) "  $(GREEN)dev$(RESET)           Start development server with hot reload"
	@$(ECHO) "  $(GREEN)build$(RESET)         Build production bundle"
	@$(ECHO) "  $(GREEN)preview$(RESET)       Preview production build locally"
	@$(ECHO) ""
	@$(ECHO) "$(UNDERLINE)Quality Commands:$(RESET)"
	@$(ECHO) "  $(GREEN)test$(RESET)          Run test suite"
	@$(ECHO) "  $(GREEN)lint$(RESET)          Run ESLint"
	@$(ECHO) "  $(GREEN)format$(RESET)        Format code (lint with fix)"
	@$(ECHO) "  $(GREEN)typecheck$(RESET)     Run TypeScript type checking"
	@$(ECHO) ""
	@$(ECHO) "$(UNDERLINE)Utility Commands:$(RESET)"
	@$(ECHO) "  $(GREEN)clean$(RESET)         Remove build artifacts and caches"
	@$(ECHO) "  $(GREEN)check-deps$(RESET)    Check if dependencies are installed"
	@$(ECHO) "  $(GREEN)help$(RESET)          Show this help message"

# Check if node and npm are available
check-deps:
	@$(ECHO) "$(YELLOW)Checking dependencies...$(RESET)"
	@command -v node >/dev/null 2>&1 || { $(ECHO) "$(RED)Error: node is not installed$(RESET)"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { $(ECHO) "$(RED)Error: npm is not installed$(RESET)"; exit 1; }
	@$(ECHO) "$(GREEN)Node version: $$(node --version)$(RESET)"
	@$(ECHO) "$(GREEN)npm version: $$(npm --version)$(RESET)"

# Install dependencies
install: check-deps
	@$(ECHO) "$(CYAN)Installing dependencies...$(RESET)"
	@cd $(FRONTEND_DIR) && npm install
	@$(ECHO) "$(GREEN)Dependencies installed successfully.$(RESET)"

# Start development server
dev: check-deps
	@$(ECHO) "$(CYAN)Starting development server...$(RESET)"
	@$(ECHO) "$(YELLOW)Dev server will be available at http://localhost:5173$(RESET)"
	@cd $(FRONTEND_DIR) && npm run dev

# Build for production
build: check-deps
	@$(ECHO) "$(CYAN)Building production bundle...$(RESET)"
	@cd $(FRONTEND_DIR) && npm run build
	@$(ECHO) "$(GREEN)Build complete! Output in $(FRONTEND_DIR)/dist/$(RESET)"

# Preview production build
preview: check-deps
	@$(ECHO) "$(CYAN)Starting preview server...$(RESET)"
	@$(ECHO) "$(YELLOW)Preview server will be available at http://localhost:4173$(RESET)"
	@cd $(FRONTEND_DIR) && npm run preview

# Run tests
test: check-deps
	@$(ECHO) "$(YELLOW)Running tests...$(RESET)"
	@cd $(FRONTEND_DIR) && npm run test
	@$(ECHO) "$(GREEN)Tests completed.$(RESET)"

# Run linter
lint: check-deps
	@$(ECHO) "$(YELLOW)Running ESLint...$(RESET)"
	@cd $(FRONTEND_DIR) && npm run lint
	@$(ECHO) "$(GREEN)Linting completed.$(RESET)"

# Format code (lint with auto-fix)
format: check-deps
	@$(ECHO) "$(YELLOW)Formatting code...$(RESET)"
	@cd $(FRONTEND_DIR) && npm run lint -- --fix || true
	@$(ECHO) "$(GREEN)Code formatted.$(RESET)"

# TypeScript type checking
typecheck: check-deps
	@$(ECHO) "$(YELLOW)Running TypeScript type checking...$(RESET)"
	@cd $(FRONTEND_DIR) && npx tsc --noEmit
	@$(ECHO) "$(GREEN)Type checking completed.$(RESET)"

# Clean build artifacts
clean:
	@$(ECHO) "$(YELLOW)Cleaning build artifacts...$(RESET)"
	@rm -rf $(FRONTEND_DIR)/dist
	@rm -rf $(FRONTEND_DIR)/node_modules/.vite
	@rm -rf $(FRONTEND_DIR)/node_modules/.cache
	@$(ECHO) "$(GREEN)Clean completed.$(RESET)"

# Clean everything including node_modules
clean-all: clean
	@$(ECHO) "$(YELLOW)Removing node_modules...$(RESET)"
	@rm -rf $(FRONTEND_DIR)/node_modules
	@$(ECHO) "$(GREEN)Full clean completed.$(RESET)"
