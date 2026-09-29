# CodeBurn Setup

This project includes a portable CodeBurn 0.9.24 runtime and a VS Code Agent Skill.

## 1. Run CodeBurn

No global npm installation is required:

```powershell
& .\.codeburn\codeburn.ps1 sessions -p today --provider copilot --no-pager
```

## 2. Enable MCP Tools In VS Code

```powershell
& .\.codeburn\install.ps1
```

Then run `Developer: Reload Window` in VS Code. The installer preserves existing MCP servers and creates `.vscode/mcp.json.codeburn-backup` before modifying an existing MCP configuration.

## 3. Use The Skill

Open a new Copilot Chat and ask, for example:

```text
CodeBurn으로 오늘 Copilot 토큰 사용량을 보여줘.
```

## Requirements

- Node.js 22.13.0 or newer
- Windows PowerShell or PowerShell 7
- VS Code with GitHub Copilot Chat

See `.codeburn/README.md` for package and license details.