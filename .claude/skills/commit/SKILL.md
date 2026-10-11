---
name: commit
description: time-checker 레포에서 git 커밋을 생성하거나 커밋 메시지를 작성/검토할 때 반드시 적용할 메시지 포맷 규칙. Conventional Commits 타입 접두사(feat/fix/chore/refactor/style/docs 등)는 영어로 유지하되 제목과 본문은 한글 명사형 종결로 쓰고, 본문은 불릿 최대 3개로 제한한다. "커밋해줘", "커밋 메시지 써줘" 같은 요청뿐 아니라, 변경사항을 git commit으로 마무리하는 모든 순간에 트리거할 것.
---

# 커밋 메시지 컨벤션

왜 이 포맷인가: 영어 서술형 문장으로 쓰면 `git log --oneline`을 훑을 때 읽는 속도가 느려지고, 불릿이 많아지면 "이 커밋이 뭘 했는지" 한눈에 안 들어온다. 명사형 종결 + 불릿 3개 제한은 "한 커밋 = 한눈에 파악되는 단위"를 강제하는 장치다. 설명할 게 4개 이상이면, 포맷을 어기기보다 커밋을 나누는 쪽으로 판단할 것.

## 형식

```
<type>: <한글 명사형 제목>

- <한글 명사형 불릿 1>
- <한글 명사형 불릿 2>   (선택)
- <한글 명사형 불릿 3>   (선택, 최대 3개)

Co-Authored-By: Claude <실제 작업 모델명> <noreply@anthropic.com>
```

## 규칙

1. **type 접두사는 영어로 유지한다.** `feat`, `fix`, `chore`, `refactor`, `style`, `docs`, `test` 등 Conventional Commits 키워드는 번역하지 않는다 — 이건 메시지 내용이 아니라 구조적 태그이기 때문이다.
2. **제목과 본문은 한글, 명사형 종결로 쓴다.** "~했습니다", "~합니다", "~하였음" 같은 서술형이 아니라 "~변경", "~추가", "~제거", "~통합", "~갱신"처럼 명사로 끝낸다.
3. **본문 불릿은 최대 3개.** 각 불릿은 한 줄, 명사형 종결. 핵심만 압축하고, 3개로 안 되면 커밋을 쪼갤 것.
4. **attribution 라인은 항상 유지하고, 실제로 작업한 모델명을 적는다.** `Co-Authored-By: Claude <모델명> <noreply@anthropic.com>`를 본문 뒤에 빈 줄 하나 두고 적는다. 모델명은 이 문서의 예시를 복사하지 말고, 커밋 시점에 작업 중인 모델 이름(예: `Claude Opus 5.5`)으로 매번 채울 것 — 모델이 바뀌어도 기록이 정확해야 하기 때문이다.
5. 제목 한 줄만으로 충분히 설명되는 아주 작은 변경(오타 수정, 포맷 1회 실행 등)은 불릿 본문을 생략해도 된다.

## 예시

**좋음**

```
refactor: components/ui 폴더 평탄화

- badge/button/card를 components 최상위로 이동
- components.json ui alias 및 oxlint ignore 목록 갱신
- 컨벤션 스킬 문서 동기화

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

**나쁨 — 영어 + 서술형 문장**

```
refactor: flatten components/ui into components

Moves badge/button/card.tsx up a level so shadcn primitives sit
directly under components/ instead of a nested ui/ subfolder.
```

**나쁨 — 불릿이 서술형, 4개 이상**

```
refactor: components/ui 폴더를 평탄화했습니다

- badge, button, card 파일들을 components 최상위로 이동했습니다
- components.json의 ui alias를 갱신했습니다
- oxlint ignore 목록도 함께 수정했습니다
- 스킬 문서도 동기화했습니다
```
