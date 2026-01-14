# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Import existing server functionality
- Server version checking and update UI
- Online players tracking tab
- Server authentication management with OAuth Device Code flow
- Firewall configuration assistant for Windows, macOS, and Linux
- Server deletion with missing folder detection
- Create server dialog with wizard flow
- User-friendly server configuration UI
- Console improvements with syntax highlighting and persistence
- Server detail view with tabs and modular components
- Dashboard metrics caching and skeleton loading states
- Custom titlebar with cross-platform support
- Dashboard redesign with Hytale theme
- SQLite database for instance management
- Server files download with progress tracking
- Integration with hytale-downloader CLI
- Java 25 detection system
- Cross-platform path detection
- JVM arguments configuration (-Xms, -Xmx, AOT Cache)
- Port and bind address configuration
- Real-time log viewer with filtering
- Interactive server console
- Server status indicator and metrics (CPU, RAM, uptime)

### Changed

- Improved settings UI with 2-column layout and save indicator
- Enhanced console and logs with syntax highlighting

### Fixed

- Use native decorations on macOS/Linux to fix performance issues
- Improved server files download and detection

## [0.1.0] - Initial Development

- Initial project setup with Tauri + React + TypeScript
- Basic project structure and configuration
