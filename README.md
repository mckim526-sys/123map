# 123map

[12·3 재판 지도 독자용 사이트](https://mckim526-sys.github.io/123map/)

## 평일 밤 10시 업데이트는 어디에서 실행되나?

한국시간 월~금 22:00에 ChatGPT 예약 작업 **재판 지도 평일 업데이트**가 실행된다. 실행 시간과 검색·검증 지시문 원본은 해당 ChatGPT 작업에 저장돼 있다. 이 저장소를 복제하면 독자용 사이트와 점검 코드를 받는다. 예약 실행 권한과 설정은 ChatGPT에서 관리한다.

2026-11-23에 확인한 예약 규칙:

```text
시간대: Asia/Seoul
RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=22;BYMINUTE=0;BYSECOND=0
```

### 밤 10시 작업이 하는 일

1. GitHub 기본 브랜치의 최신 소스와 마지막 성공 배포를 확인한다. 월요일에는 금요일 업데이트 이후 주말 보도도 확인한다.
2. 네 특검 사건의 새 기소, 공판, 심급별 판단·형량, 상소와 누락 사건을 검색한다. 연합뉴스·뉴스1·뉴시스·MBC와 접근 가능한 법원 자료 등을 대조한다.
3. 확인된 변화가 있는 인물의 해당 재판 기록을 [reader-data.js](reader-data.js)에서 갱신한다. 구형·선고·확정·선고 예정을 구별하고, 판단이 달라진 근거나 감형 이유가 확인되면 기록한다. 공개 기사 링크는 MBC 원문만 수록하고 타사 자료·판결문 등 검증 근거는 공개 저장소 밖에서 보관한다.
4. 인물별 상세 주소와 공개 출처 제한을 검사하고 게시 직전에 원격 변경을 다시 확인한다. 변경이 있으면 같은 저장소에 병합한 뒤 GitHub Pages 배포와 실제 독자 화면을 확인한다. 변경 사항이 없으면 재배포하지 않는다.

| 찾는 내용 | 위치 |
| --- | --- |
| 오늘 확인할 기존 일정과 상소 여부 후보 | [scripts/agenda.js](scripts/agenda.js) — `node scripts/agenda.js --json`으로 출력 |
| 공개된 변경 요약 | [changelog.js](changelog.js) |
| 상세 주소 및 공개 출처 검사 | [navigation.test.cjs](tests/navigation.test.cjs), [public-sources.test.cjs](tests/public-sources.test.cjs) |
| 실제 반영 예시 | [2026-11-20 변경분](https://github.com/mckim526-sys/123map/commit/f15ca0a9e3f2187d40343109a647f1ece803bf64) · [해당 배포 기록](https://github.com/mckim526-sys/123map/actions/runs/44742192290) |

[AGENTS.md](AGENTS.md)에 나오는 오전 7시 46분 일정 확인은 별도로 문서화된 절차다. `scripts/agenda.js`는 등록 데이터를 읽어 확인 목록을 출력한다. 밤 10시의 기사 검색·사실 확인·게시를 단독으로 실행하는 스크립트는 저장소에 없다. 시간을 바꾸려면 ChatGPT의 **재판 지도 평일 업데이트** 예약 설정을 변경한다.
