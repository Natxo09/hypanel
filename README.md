# HyPanel

A desktop application built with Tauri + React for creating and managing dedicated Hytale servers. Download server files, configure instances, manage mods, worlds, permissions, and monitor server status in real-time.

> **Note:** The current logo is temporary. Contributions for a better logo are welcome!

## Platform Support

| Platform | Status |
|----------|--------|
| Windows | Tested |
| macOS | In Testing |
| Linux | Not Tested |

Contributions for testing on macOS and Linux are welcome!

## Screenshots

*Coming soon*

## Features

- [x] Java 25 detection system
- [x] Cross-platform path detection (Windows, macOS, Linux)
- [x] Integration with hytale-downloader CLI
- [x] Download UI with progress bar and channel selector (release/pre-release)
- [x] Create and delete server instances
- [x] Start and stop server with process management
- [x] Server execution arguments configuration
- [x] JVM arguments configuration (-Xms, -Xmx, AOT Cache)
- [x] OAuth Device Code authentication flow
- [x] Authentication state management per server
- [x] Port and bind address configuration
- [x] Firewall configuration assistant
- [x] Real-time log viewer with filtering
- [x] Interactive server console
- [x] Server status indicator and metrics (CPU, RAM, uptime)
- [x] Protocol version compatibility checking
- [x] Import existing servers

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Rust + Tauri v2
- **UI Components:** shadcn/ui + Tailwind CSS
- **Database:** SQLite

## Requirements

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://www.rust-lang.org/tools/install)
- [Java 25](https://adoptium.net/) (Temurin recommended)

### Platform-specific

**Windows:**
- WebView2 (included in Windows 10/11)

**macOS:**
- Xcode Command Line Tools

**Linux:**
```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

## Installation

### From Releases

Download the latest release for your platform from the [Releases](https://github.com/Natxo09/hypanel/releases) page:

- **macOS (Apple Silicon):** `.dmg` (arm64)
- **macOS (Intel):** `.dmg` (x64)
- **Windows:** `.msi` or `.exe`
- **Linux:** `.deb` or `.AppImage`

### From Source

```bash
# Clone the repository
git clone https://github.com/Natxo09/hypanel.git
cd hypanel

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Roadmap

### In Progress

- [ ] Server config.json visual editor
- [ ] Permissions.json editor
- [ ] Bans.json editor
- [ ] Whitelist.json editor
- [ ] Worlds listing and management (universe/worlds)
- [ ] World configuration editor

### Planned

- [ ] Automatic backup system
- [ ] Mod management (install/uninstall)
- [ ] Recommended hosting plugins integration
- [ ] QUIC/UDP protocol information
- [ ] Multiple server instances management
- [ ] Player Referral system between servers
- [ ] Connection Redirect system
- [ ] Disconnect Fallback system
- [ ] Custom proxy building documentation

### Future

- [ ] Server Discovery integration
- [ ] Official Hytale APIs integration
- [ ] Integrated payment system support
- [ ] Maven Central dependency for modding

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Logo Contribution

We are currently looking for a logo designer. If you're interested in contributing a logo for HyPanel, please open an issue or submit a PR.

## License

[MIT](LICENSE)

## Acknowledgments

- [Hytale](https://hytale.com/) for the amazing game
- [Tauri](https://tauri.app/) for the framework
- [shadcn/ui](https://ui.shadcn.com/) for the UI components
