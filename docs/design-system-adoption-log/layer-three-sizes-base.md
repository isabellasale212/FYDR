# sizes: 0 repointed, 2 left as literals

## Repointed

| File | Line | Property | Was | Now | Note |
|---|---|---|---|---|---|

## Left as literals

| File | Line | Property | Value | Why |
|---|---|---|---|---|
| src/styles/base.css | 12797 | font-size | 386px | 386.0px has no exact token; nearest would move it — left |
| src/styles/base.css | 13227 | font-size | clamp(34px, 3.5vw, var(--fs-48)) | not a px/rem literal (em, clamp, keyword) |
