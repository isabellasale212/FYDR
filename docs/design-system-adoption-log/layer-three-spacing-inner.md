# spacing-inner: 13 repointed, 11 left as literals

## Repointed

| File | Line | Property | Was | Now | Note |
|---|---|---|---|---|---|
| src/styles/base.css | 1614 | padding | calc(22px + env(safe-area-inset-top, 0px)) 0 14px | calc(var(--s-11) + env(safe-area-inset-top, 0px)) 0 var(--s-7) | exact steps inside a fallback or calc() |
| src/styles/base.css | 1648 | padding | 9px 6px calc(10px + env(safe-area-inset-bottom, 0px)) | 9px var(--s-3) calc(var(--s-5) + env(safe-area-inset-bottom, 0px)) | exact steps inside a fallback or calc() |
| src/styles/base.css | 1702 | padding | var(--sp-14) var(--pad-card-x, 18px) var(--sp-10) | var(--sp-14) var(--pad-card-x, var(--s-9)) var(--sp-10) | exact steps inside a fallback or calc() |
| src/styles/base.css | 1719 | padding | var(--sp-12) var(--pad-card-x, 18px) | var(--sp-12) var(--pad-card-x, var(--s-9)) | exact steps inside a fallback or calc() |
| src/styles/base.css | 1785 | padding | var(--sp-14) var(--pad-card-x, 18px) | var(--sp-14) var(--pad-card-x, var(--s-9)) | exact steps inside a fallback or calc() |
| src/styles/base.css | 1815 | padding | 0 var(--pad-card-x, 18px) var(--sp-12) | 0 var(--pad-card-x, var(--s-9)) var(--sp-12) | exact steps inside a fallback or calc() |
| src/styles/base.css | 2856 | padding | calc(14px + env(safe-area-inset-top, 0px)) 0 12px | calc(var(--s-7) + env(safe-area-inset-top, 0px)) 0 var(--s-6) | exact steps inside a fallback or calc() |
| src/styles/base.css | 3575 | padding | calc(40px + env(safe-area-inset-top, 0px)) 24px
    calc(30px + env(safe-area-inset-bottom, 0px)) | calc(var(--s-14) + env(safe-area-inset-top, 0px)) var(--sp-24)
    calc(var(--s-13) + env(safe-area-inset-bottom, 0px)) | exact steps inside a fallback or calc() |
| src/styles/base.css | 3747 | padding | calc(16px + env(safe-area-inset-top, 0px)) 16px 12px | calc(var(--s-8) + env(safe-area-inset-top, 0px)) var(--s-8) var(--s-6) | exact steps inside a fallback or calc() |
| src/styles/base.css | 8749 | margin | 0 calc(-1 * var(--main-pad, 28px)) 14px | 0 calc(-1 * var(--main-pad, var(--sp-28))) var(--s-7) | exact steps inside a fallback or calc() |
| src/styles/base.css | 8750 | padding | var(--sp-10) var(--main-pad, 28px) | var(--sp-10) var(--main-pad, var(--sp-28)) | exact steps inside a fallback or calc() |
| src/styles/base.css | 13208 | padding | calc(178px + var(--claim-lead)) var(--claim-x) 40px | calc(178px + var(--claim-lead)) var(--claim-x) var(--s-14) | exact steps inside a fallback or calc() |
| src/styles/base.css | 14406 | padding | 9px 6px calc(10px + env(safe-area-inset-bottom, 0px)) | 9px var(--s-3) calc(var(--s-5) + env(safe-area-inset-bottom, 0px)) | exact steps inside a fallback or calc() |

## Left as literals

| File | Line | Property | Value | Why |
|---|---|---|---|---|
| src/styles/base.css | 550 | padding | var(--sp-28) var(--main-pad) 64px | px inside var()/calc() with no exact step; left |
| src/styles/base.css | 557 | padding | var(--sp-20) var(--main-pad) 56px | px inside var()/calc() with no exact step; left |
| src/styles/base.css | 567 | padding | calc(64px + var(--sp-18)) var(--main-pad) calc(var(--sp-48) + 64px + env(safe-area-inset-bottom, 0px)) | px inside var()/calc() with no exact step; left |
| src/styles/base.css | 3336 | padding | var(--sp-14) var(--sp-20) calc(var(--sp-8) + env(safe-area-inset-bottom, 0px)) | px inside var()/calc() with no exact step; left |
| src/styles/base.css | 4316 | bottom | calc(106px + env(safe-area-inset-bottom, 0px)) | px inside var()/calc() with no exact step; left |
| src/styles/base.css | 7812 | padding | 1px var(--sp-8) 1px var(--sp-6) | px inside var()/calc() with no exact step; left |
| src/styles/base.css | 8607 | margin | var(--sp-12) -12px 0 | px inside var()/calc() with no exact step; left |
| src/styles/base.css | 9475 | padding | 1px var(--sp-6) | px inside var()/calc() with no exact step; left |
| src/styles/base.css | 12950 | padding | 176px var(--sp-28) var(--sp-40) | px inside var()/calc() with no exact step; left |
| src/styles/base.css | 13387 | padding | calc(160px + var(--sp-4)) var(--launch-x) var(--sp-24) | px inside var()/calc() with no exact step; left |
| src/styles/base.css | 14486 | padding | var(--sp-12) var(--sp-16) calc(var(--sp-16) + env(safe-area-inset-bottom, 0px)) | px inside var()/calc() with no exact step; left |
