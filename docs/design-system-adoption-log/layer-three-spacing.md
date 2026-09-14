# spacing: 20 repointed, 65 left as literals

## Repointed

| File | Line | Property | Was | Now | Note |
|---|---|---|---|---|---|
| src/styles/base.css | 115 | inset-inline-start | 8px | var(--s-4) |  |
| src/styles/base.css | 116 | top | 8px | var(--s-4) |  |
| src/styles/base.css | 4314 | left | 16px | var(--s-8) |  |
| src/styles/base.css | 4315 | right | 16px | var(--s-8) |  |
| src/styles/base.css | 7822 | left | 4px | var(--s-2) |  |
| src/styles/base.css | 7823 | right | 4px | var(--s-2) |  |
| src/styles/base.css | 7847 | top | 2px | var(--s-1) |  |
| src/styles/base.css | 9092 | right | 10px | var(--s-5) |  |
| src/styles/base.css | 9150 | right | 2px | var(--s-1) |  |
| src/styles/base.css | 9171 | left | 2px | var(--s-1) |  |
| src/styles/base.css | 9172 | right | 2px | var(--s-1) |  |
| src/styles/base.css | 9230 | left | 8px | var(--s-4) |  |
| src/styles/base.css | 9247 | right | 8px | var(--s-4) |  |
| src/styles/base.css | 9419 | left | 4px | var(--s-2) |  |
| src/styles/base.css | 9420 | right | 4px | var(--s-2) |  |
| src/styles/base.css | 10352 | top | 6px | var(--s-3) |  |
| src/styles/base.css | 10381 | top | 2px | var(--s-1) |  |
| src/styles/base.css | 12785 | left | 40px | var(--s-14) |  |
| src/styles/base.css | 12938 | left | 30px | var(--s-13) |  |
| src/styles/base.css | 13966 | right | 14px | var(--s-7) |  |

## Left as literals

| File | Line | Property | Value | Why |
|---|---|---|---|---|
| src/styles/base.css | 105 | inset-inline-start | -9999px | negative — left |
| src/styles/base.css | 123 | margin | -1px | negative — left |
| src/styles/base.css | 358 | margin | -1px | negative — left |
| src/styles/base.css | 374 | margin | -1px | negative — left |
| src/styles/base.css | 411 | left | 3px | no step — left |
| src/styles/base.css | 412 | bottom | -10px | negative — left |
| src/styles/base.css | 482 | margin | -1px | negative — left |
| src/styles/base.css | 550 | padding | var(--sp-28) var(--main-pad) 64px | no step — left |
| src/styles/base.css | 557 | padding | var(--sp-20) var(--main-pad) 56px | no step — left |
| src/styles/base.css | 567 | padding | calc(64px + var(--sp-18)) var(--main-pad) calc(var(--sp-48) + 64px + env(safe-area-inset-bottom, 0px)) | mixed with calc/%/em; left |
| src/styles/base.css | 1614 | padding | calc(22px + env(safe-area-inset-top, 0px)) 0 14px | mixed with calc/%/em; left |
| src/styles/base.css | 1648 | padding | 9px 6px calc(10px + env(safe-area-inset-bottom, 0px)) | mixed with calc/%/em; left |
| src/styles/base.css | 1702 | padding | var(--sp-14) var(--pad-card-x, 18px) var(--sp-10) | not px — left |
| src/styles/base.css | 1719 | padding | var(--sp-12) var(--pad-card-x, 18px) | not px — left |
| src/styles/base.css | 1785 | padding | var(--sp-14) var(--pad-card-x, 18px) | not px — left |
| src/styles/base.css | 1815 | padding | 0 var(--pad-card-x, 18px) var(--sp-12) | not px — left |
| src/styles/base.css | 1928 | margin-inline-start | 1px | no step — left |
| src/styles/base.css | 2492 | padding-top | 1px | no step — left |
| src/styles/base.css | 2856 | padding | calc(14px + env(safe-area-inset-top, 0px)) 0 12px | mixed with calc/%/em; left |
| src/styles/base.css | 2881 | margin | -5px -5px 0 0 | negative — left |
| src/styles/base.css | 3336 | padding | var(--sp-14) var(--sp-20) calc(var(--sp-8) + env(safe-area-inset-bottom, 0px)) | mixed with calc/%/em; left |
| src/styles/base.css | 3575 | padding | calc(40px + env(safe-area-inset-top, 0px)) 24px
    calc(30px + env(safe-area-inset-bottom, 0px)) | mixed with calc/%/em; left |
| src/styles/base.css | 3747 | padding | calc(16px + env(safe-area-inset-top, 0px)) 16px 12px | mixed with calc/%/em; left |
| src/styles/base.css | 4316 | bottom | calc(106px + env(safe-area-inset-bottom, 0px)) | mixed with calc/%/em; left |
| src/styles/base.css | 4341 | margin | -6px | negative — left |
| src/styles/base.css | 6023 | margin-top | 1px | no step — left |
| src/styles/base.css | 7012 | margin-top | 1px | no step — left |
| src/styles/base.css | 7660 | top | -2px | negative — left |
| src/styles/base.css | 7661 | bottom | -2px | negative — left |
| src/styles/base.css | 7744 | margin-top | 1px | no step — left |
| src/styles/base.css | 7812 | padding | 1px var(--sp-8) 1px var(--sp-6) | no step — left |
| src/styles/base.css | 7824 | top | 5px | no step — left |
| src/styles/base.css | 7831 | top | 3px | no step — left |
| src/styles/base.css | 8607 | margin | var(--sp-12) -12px 0 | negative — left |
| src/styles/base.css | 8645 | margin | 1px 0 0 | no step — left |
| src/styles/base.css | 8749 | margin | 0 calc(-1 * var(--main-pad, 28px)) 14px | mixed with calc/%/em; left |
| src/styles/base.css | 8750 | padding | var(--sp-10) var(--main-pad, 28px) | not px — left |
| src/styles/base.css | 9179 | gap | 1px | no step — left |
| src/styles/base.css | 9305 | left | -4px | negative — left |
| src/styles/base.css | 9475 | padding | 1px var(--sp-6) | no step — left |
| src/styles/base.css | 10080 | padding-inline-end | 52px | no step — left |
| src/styles/base.css | 10191 | top | -3px | negative — left |
| src/styles/base.css | 10192 | right | -3px | negative — left |
| src/styles/base.css | 10362 | top | 3px | no step — left |
| src/styles/base.css | 10372 | margin-inline-start | -1px | negative — left |
| src/styles/base.css | 10384 | margin-inline-start | -5px | negative — left |
| src/styles/base.css | 11032 | top | 3px | no step — left |
| src/styles/base.css | 11033 | left | 3px | no step — left |
| src/styles/base.css | 11104 | top | 3px | no step — left |
| src/styles/base.css | 11105 | left | 3px | no step — left |
| src/styles/base.css | 11415 | top | -2px | negative — left |
| src/styles/base.css | 11416 | bottom | -2px | negative — left |
| src/styles/base.css | 12427 | inset-inline-start | 13px | no step — left |
| src/styles/base.css | 12442 | padding-inline-start | 36px | no step — left |
| src/styles/base.css | 12939 | top | 92px | no step — left |
| src/styles/base.css | 12950 | padding | 176px var(--sp-28) var(--sp-40) | no step — left |
| src/styles/base.css | 13178 | top | 92px | no step — left |
| src/styles/base.css | 13208 | padding | calc(178px + var(--claim-lead)) var(--claim-x) 40px | mixed with calc/%/em; left |
| src/styles/base.css | 13326 | padding | 0 64px | no step — left |
| src/styles/base.css | 13387 | padding | calc(160px + var(--sp-4)) var(--launch-x) var(--sp-24) | mixed with calc/%/em; left |
| src/styles/base.css | 13597 | inset-inline-end | 9px | no step — left |
| src/styles/base.css | 14406 | padding | 9px 6px calc(10px + env(safe-area-inset-bottom, 0px)) | mixed with calc/%/em; left |
| src/styles/base.css | 14452 | top | -6px | negative — left |
| src/styles/base.css | 14453 | right | -10px | negative — left |
| src/styles/base.css | 14486 | padding | var(--sp-12) var(--sp-16) calc(var(--sp-16) + env(safe-area-inset-bottom, 0px)) | mixed with calc/%/em; left |
