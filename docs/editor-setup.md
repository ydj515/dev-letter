# Editor Setup

## VS Code

- 워크스페이스에 `.vscode/settings.json`이 포함되어 있으므로 추가 설정 없이 저장 시 Prettier 포맷이 적용됩니다.
- 필요한 확장:
  - **ESLint** (dbaeumer.vscode-eslint)
  - **Prettier – Code formatter** (esbenp.prettier-vscode)
- 프로젝트가 제공하는 Prettier 설정(`.prettierrc.json`)이 없으면 포맷을 차단하도록 `prettier.requireConfig`가 활성화되어 있습니다.

## Formatter rules

- 따옴표: 더블 쿼트(`"`) 고정
- 세미콜론: 항상 사용
- 들여쓰기: 스페이스 2칸
- 줄바꿈: LF (`\n`)

에디터 외부에서 포맷이 필요하면 다음 명령을 사용할 수 있습니다(Prettier가 설치되어 있을 때):

```bash
npx prettier --write .
```

> 로컬에 Prettier가 없다면 전역 설치 또는 `npm install --save-dev prettier` 후 실행하세요.
