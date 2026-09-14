# motion: 2 repointed, 15 left as literals

## Repointed

| File | Line | Property | Was | Now | Note |
|---|---|---|---|---|---|
| src/styles/base.css | 5171 | transition | transform 0.15s | transform var(--dur) |  |
| src/styles/base.css | 6356 | transition | transform 150ms ease | transform var(--dur) ease |  |

## Left as literals

| File | Line | Property | Value | Why |
|---|---|---|---|---|
| src/styles/base.css | 172 | animation-duration | 0.001ms !important | no System A duration/curve for it; left |
| src/styles/base.css | 12847 | animation | lk-letter 0.62s cubic-bezier(0.165, 0.84, 0.44, 1) both | no System A duration/curve for it; left |
| src/styles/base.css | 12863 | animation | lk-draw 0.91s cubic-bezier(0.45, 0, 0.55, 1) 0.14s both | no System A duration/curve for it; left |
| src/styles/base.css | 12866 | animation | lk-fade 0.14s linear 1.13s both | no System A duration/curve for it; left |
| src/styles/base.css | 12870 | animation | lk-draw 0.35s cubic-bezier(0.45, 0, 0.55, 1) 1.2s both | no System A duration/curve for it; left |
| src/styles/base.css | 12873 | animation | lk-pop 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) 1.15s both | no System A duration/curve for it; left |
| src/styles/base.css | 13006 | animation | launch-lift 0.55s cubic-bezier(0.165, 0.84, 0.44, 1) 1.62s both | no System A duration/curve for it; left |
| src/styles/base.css | 13018 | animation | launch-ground 0.55s cubic-bezier(0.165, 0.84, 0.44, 1) 1.62s both | no System A duration/curve for it; left |
| src/styles/base.css | 13021 | animation | launch-ink 0.55s cubic-bezier(0.165, 0.84, 0.44, 1) 1.62s both | no System A duration/curve for it; left |
| src/styles/base.css | 13024 | animation | lk-draw 0.91s cubic-bezier(0.45, 0, 0.55, 1) 0.14s both,
    launch-stroke 0.55s cubic-bezier(0.165, 0.84, 0.44, 1) 1.62s both | no System A duration/curve for it; left |
| src/styles/base.css | 13029 | animation | lk-draw 0.35s cubic-bezier(0.45, 0, 0.55, 1) 1.2s both,
    launch-stroke 0.55s cubic-bezier(0.165, 0.84, 0.44, 1) 1.62s both | no System A duration/curve for it; left |
| src/styles/base.css | 13034 | animation | lk-pop 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) 1.15s both,
    launch-fill 0.55s cubic-bezier(0.165, 0.84, 0.44, 1) 1.62s both | no System A duration/curve for it; left |
| src/styles/base.css | 13041 | animation | launch-step 0.32s cubic-bezier(0.165, 0.84, 0.44, 1) both | no System A duration/curve for it; left |
| src/styles/base.css | 13118 | animation | launch-step 0.32s cubic-bezier(0.165, 0.84, 0.44, 1) both | no System A duration/curve for it; left |
| src/styles/base.css | 13319 | animation | launch-panel 0.5s cubic-bezier(0.165, 0.84, 0.44, 1) 1.9s both | no System A duration/curve for it; left |
