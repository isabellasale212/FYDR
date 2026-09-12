/* @ds-bundle: {"format":4,"namespace":"FydrDesignSystem_7dfa05","components":[{"name":"ScaleSelector","sourcePath":"components/controls/ScaleSelector.jsx"},{"name":"SegmentedControl","sourcePath":"components/controls/SegmentedControl.jsx"},{"name":"Stepper","sourcePath":"components/controls/Stepper.jsx"},{"name":"Toggle","sourcePath":"components/controls/Toggle.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"Pill","sourcePath":"components/core/Pill.jsx"},{"name":"Dial","sourcePath":"components/data/Dial.jsx"},{"name":"DomainDot","sourcePath":"components/data/DomainDot.jsx"},{"name":"MeterBar","sourcePath":"components/data/MeterBar.jsx"},{"name":"RangeBar","sourcePath":"components/data/RangeBar.jsx"},{"name":"Sparkline","sourcePath":"components/data/Sparkline.jsx"},{"name":"StatBar","sourcePath":"components/data/StatBar.jsx"},{"name":"TableShell","sourcePath":"components/data/TableShell.jsx"},{"name":"TableGroup","sourcePath":"components/data/TableShell.jsx"},{"name":"TableRow","sourcePath":"components/data/TableShell.jsx"},{"name":"SidebarNav","sourcePath":"components/navigation/SidebarNav.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"},{"name":"Banner","sourcePath":"components/patterns/Banner.jsx"},{"name":"EmptyState","sourcePath":"components/patterns/EmptyState.jsx"},{"name":"FlagCard","sourcePath":"components/patterns/FlagCard.jsx"},{"name":"PageHeader","sourcePath":"components/patterns/PageHeader.jsx"},{"name":"ReadCard","sourcePath":"components/patterns/ReadCard.jsx"},{"name":"MyDataScreen","sourcePath":"ui_kits/athlete_app/MyDataScreen.jsx"},{"name":"Phone","sourcePath":"ui_kits/athlete_app/Phone.jsx"},{"name":"TodayScreen","sourcePath":"ui_kits/athlete_app/TodayScreen.jsx"},{"name":"WellnessSheet","sourcePath":"ui_kits/athlete_app/WellnessSheet.jsx"},{"name":"DashboardScreen","sourcePath":"ui_kits/staff_web/DashboardScreen.jsx"},{"name":"GateScreen","sourcePath":"ui_kits/staff_web/GateScreen.jsx"},{"name":"SettingsScreen","sourcePath":"ui_kits/staff_web/SettingsScreen.jsx"},{"name":"NAV","sourcePath":"ui_kits/staff_web/Shell.jsx"},{"name":"GROUPS","sourcePath":"ui_kits/staff_web/Shell.jsx"},{"name":"Shell","sourcePath":"ui_kits/staff_web/Shell.jsx"},{"name":"TrainingReportScreen","sourcePath":"ui_kits/staff_web/TrainingReportScreen.jsx"}],"sourceHashes":{"components/controls/ScaleSelector.jsx":"36be12e506d7","components/controls/SegmentedControl.jsx":"12decfa0c8b4","components/controls/Stepper.jsx":"b10ef65fbc4f","components/controls/Toggle.jsx":"3949d1b894e2","components/core/Avatar.jsx":"ade9f0c8ead2","components/core/Button.jsx":"aec713575b0b","components/core/Card.jsx":"0d3128178b3f","components/core/Chip.jsx":"370c8f0b3029","components/core/Eyebrow.jsx":"4f3544085220","components/core/Pill.jsx":"d92cd0654b0c","components/data/Dial.jsx":"d41a1ea4811c","components/data/DomainDot.jsx":"e2d3dcfd3bec","components/data/MeterBar.jsx":"af6af12dd2e6","components/data/RangeBar.jsx":"98fc847aae55","components/data/Sparkline.jsx":"169032b03a27","components/data/StatBar.jsx":"c5c2a4c590af","components/data/TableShell.jsx":"7ee28bdfee0e","components/navigation/SidebarNav.jsx":"4e53de07c643","components/navigation/TabBar.jsx":"8471aeeb5fdb","components/patterns/Banner.jsx":"ccfbf40b3a1d","components/patterns/EmptyState.jsx":"a78a82b3135a","components/patterns/FlagCard.jsx":"a643e92b6d2a","components/patterns/PageHeader.jsx":"75d50bd3e984","components/patterns/ReadCard.jsx":"febbdb547dfc","ui_kits/athlete_app/MyDataScreen.jsx":"0615448f6d2f","ui_kits/athlete_app/Phone.jsx":"f64ac474a501","ui_kits/athlete_app/TodayScreen.jsx":"74d1f8bde774","ui_kits/athlete_app/WellnessSheet.jsx":"feae7b0f4226","ui_kits/staff_web/DashboardScreen.jsx":"60cca8d54f08","ui_kits/staff_web/GateScreen.jsx":"ac949179508a","ui_kits/staff_web/SettingsScreen.jsx":"79b0e063e7a3","ui_kits/staff_web/Shell.jsx":"11b22dfc53e6","ui_kits/staff_web/TrainingReportScreen.jsx":"4ddaeee6ea0e"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.FydrDesignSystem_7dfa05 = window.FydrDesignSystem_7dfa05 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/controls/ScaleSelector.jsx
try { (() => {
/* The 1-to-5 wellness scale. Coarse on purpose, and worded at both ends, so an athlete
   answers without deliberating. Fills cumulatively, because "3 of 5" reads faster as a
   quantity than as a single marked dot.

   The fill is always --accent, never the answer's semantic tone. A low score turning red
   tells the athlete which answer is the "wrong" one, and they start logging the number
   that keeps the screen calm rather than the number that is true. The tone belongs on
   the coach's side of the product, once the value is data.

   Depth comes from elevation, not from a graded fill:

   - An unanswered bar is a RECESSED channel — an inset shadow, so the row reads as five
     empty slots waiting to be filled.
   - A filled bar is RAISED — solid accent on --shadow-knob with an inset top highlight,
     the same raised-control language as the toggle knob and the segmented thumb.
     - The HEAD of the fill (the bar the athlete actually chose) is lifted a step further:
       a lighter mix of the accent plus the selection ring. Without it the row states a
       quantity but not a choice.

   The anchor words sit on their own raised chips rather than as loose text, so the two
   ends of the scale read as fixed reference points — an athlete checks which direction
   is good by glancing at them, and they should look like part of the control. */
function ScaleSelector({
  value,
  words = [],
  low,
  high,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '5px'
    }
  }, [1, 2, 3, 4, 5].map(n => {
    const on = value != null && n <= value;
    const head = value === n;
    return /*#__PURE__*/React.createElement("button", {
      key: n,
      type: "button",
      onClick: () => onChange && onChange(n),
      "aria-label": words[n - 1] || String(n),
      "aria-pressed": value === n,
      title: words[n - 1],
      style: {
        height: 'var(--touch-min)',
        padding: 0,
        cursor: 'pointer',
        borderRadius: 'var(--r)',
        background: head ? 'color-mix(in oklab, var(--accent) 88%, white)' : on ? 'var(--accent)' : 'var(--surf2)',
        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'),
        boxShadow: on ? head ? 'var(--ring-select), var(--shadow-knob), inset 0 1px 0 rgba(255,255,255,0.3)' : 'var(--shadow-knob), inset 0 1px 0 rgba(255,255,255,0.22)' : 'inset 0 1px 2px rgba(23,40,80,0.12)',
        transition: 'var(--t-state), box-shadow var(--dur)'
      }
    });
  })), (low || high) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '8px',
      marginTop: '10px'
    }
  }, [low, high].map((w, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontSize: 'var(--t-eyebrow)',
      fontWeight: 600,
      color: 'var(--muted)',
      background: 'var(--surf)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r)',
      padding: '4px 9px',
      boxShadow: 'var(--shadow-knob)',
      whiteSpace: 'nowrap'
    }
  }, w))));
}
Object.assign(__ds_scope, { ScaleSelector });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/ScaleSelector.jsx", error: String((e && e.message) || e) }); }

// components/controls/SegmentedControl.jsx
try { (() => {
/* Two or three mutually exclusive views of the same data. The track is a tinted well
   and the active segment is a raised white pill — the inverse of a chip row, because
   these switch how you read a screen rather than what it contains.

   The active segment carries --shadow-knob, the same token the toggle knob uses: a
   small control lifted off its own track. That is not a second elevation level — cards
   still share the one --shadow, and nothing here competes with them. */
function SegmentedControl({
  options = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '4px',
      background: 'var(--hair)',
      borderRadius: 'var(--r)',
      padding: '4px',
      ...style
    }
  }, options.map(o => {
    const v = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : o.label;
    const on = v === value;
    return /*#__PURE__*/React.createElement("button", {
      key: v,
      type: "button",
      onClick: () => onChange && onChange(v),
      style: {
        fontFamily: 'var(--font-core)',
        fontSize: 'var(--t-body-2xs)',
        fontWeight: 700,
        padding: '7px 16px',
        borderRadius: 'var(--r)',
        border: 'none',
        background: on ? 'var(--surf)' : 'transparent',
        color: on ? 'var(--accent)' : 'var(--muted)',
        boxShadow: on ? 'var(--shadow-knob)' : 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background var(--dur), color var(--dur), box-shadow var(--dur)'
      }
    }, label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/controls/Stepper.jsx
try { (() => {
/* A discrete value a coach nudges: a rule per kilogram, a session start, hours of
   sleep. The step size is stated under the control, because a stepper that moves in
   fifteen-minute jumps has to say so.

   The two buttons carry --shadow-knob — the same raised-control token the toggle knob
   and the active segment use — so they read as pressable against the card behind them.
   That is not a second elevation level; cards still own the only --shadow. */
function Stepper({
  value,
  unit,
  step = 1,
  min,
  max,
  hint,
  size = 'md',
  onChange,
  style
}) {
  const big = size === 'lg';
  const btn = big ? 46 : 32;
  const clamp = v => Math.min(max != null ? max : Infinity, Math.max(min != null ? min : -Infinity, v));
  const bump = d => onChange && onChange(clamp((typeof value === 'number' ? value : 0) + d));
  const control = /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: btn + 'px minmax(0, 1fr) ' + btn + 'px',
      gap: big ? '12px' : '8px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => bump(-step),
    style: {
      height: btn,
      borderRadius: 'var(--r)',
      background: 'var(--surf)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-knob)',
      display: 'grid',
      placeItems: 'center',
      fontSize: big ? '20px' : '15px',
      color: 'var(--accent)',
      cursor: 'pointer'
    }
  }, "\u2212"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: big ? '30px' : 'var(--t-num-lead)',
      fontWeight: 500,
      lineHeight: 1.1
    }
  }, value), unit && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: big ? '11.5px' : '10px',
      color: 'var(--faint)'
    }
  }, unit)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => bump(step),
    style: {
      height: btn,
      borderRadius: 'var(--r)',
      background: 'var(--surf)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-knob)',
      display: 'grid',
      placeItems: 'center',
      fontSize: big ? '20px' : '15px',
      color: 'var(--accent)',
      cursor: 'pointer'
    }
  }, "+"));
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, control, hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-micro)',
      color: 'var(--faint)',
      marginTop: '8px'
    }
  }, hint));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/controls/Toggle.jsx
try { (() => {
/* Two sizes and two meanings. `sm` is an on/off switch for a rule. `lg` is a two-way
   choice, and both its labels stay legible — a Basic club has to be able to read what
   it is not on.

   The track is a RECESSED channel and the knob is RAISED, at both sizes — the same
   language as the wellness scale and the segmented thumb. The knob previously only
   carried its shadow at `lg`, which left the rule switch reading as a flat painted
   rectangle rather than something that moves. */
const SIZES = {
  sm: {
    w: 38,
    h: 22,
    knob: 16,
    pad: 3
  },
  lg: {
    w: 54,
    h: 30,
    knob: 24,
    pad: 3
  }
};
function Toggle({
  on = false,
  size = 'sm',
  onChange,
  labels,
  style
}) {
  const s = SIZES[size] || SIZES.sm;
  const travel = s.w - s.pad * 2 - s.knob;
  const track = /*#__PURE__*/React.createElement("div", {
    onClick: () => onChange && onChange(!on),
    style: {
      width: s.w,
      height: s.h,
      flex: 'none',
      borderRadius: 'var(--r)',
      padding: s.pad,
      cursor: 'pointer',
      transition: 'background var(--dur)',
      background: on ? 'var(--accent)' : 'var(--track-off)',
      boxShadow: 'inset 0 1px 2px rgba(23,40,80,' + (on ? '0.28' : '0.16') + ')',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: s.knob,
      height: s.knob,
      borderRadius: 'var(--r-knob)',
      background: '#ffffff',
      boxShadow: 'var(--shadow-knob), inset 0 -1px 0 rgba(23,40,80,0.08)',
      transition: 'transform var(--dur)',
      transform: 'translateX(' + (on ? travel : 0) + 'px)'
    }
  }));
  if (!labels) return /*#__PURE__*/React.createElement("div", {
    style: style
  }, track);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      fontWeight: 700,
      color: on ? 'var(--faint)' : 'var(--text)'
    }
  }, labels[0]), track, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      fontWeight: 700,
      color: on ? 'var(--accent)' : 'var(--faint)'
    }
  }, labels[1]));
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
/* Initials on navy. Fydr has no athlete photography, so identity is typographic. */
const SIZES = {
  sm: {
    box: 26,
    radius: 'var(--r)',
    font: '10.5px'
  },
  md: {
    box: 30,
    radius: 'var(--r)',
    font: '10.5px'
  },
  lg: {
    box: 38,
    radius: 'var(--r)',
    font: '11.5px'
  },
  xl: {
    box: 40,
    radius: 'var(--r)',
    font: '12px'
  },
  '2xl': {
    box: 56,
    radius: 'var(--r-round)',
    font: '18px'
  }
};
function Avatar({
  name,
  initials,
  size = 'lg',
  role = 'athlete',
  style
}) {
  const s = SIZES[size] || SIZES.lg;
  const text = initials || (name || '').split(', ').reverse().map(p => (p || '')[0]).join('');
  const nutrition = role === 'nutrition';
  return /*#__PURE__*/React.createElement("div", {
    title: name,
    style: {
      width: s.box,
      height: s.box,
      flex: 'none',
      borderRadius: s.radius,
      background: nutrition ? 'var(--avatar-bg-nutrition)' : 'var(--avatar-bg)',
      color: nutrition ? 'var(--avatar-text-nutrition)' : 'var(--avatar-text)',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--font-core)',
      fontSize: s.font,
      fontWeight: 700,
      letterSpacing: '0.02em',
      ...style
    }
  }, text);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
/* Three treatments and no more.

   Primary is the accent solid — the deep blue #17489b — carrying a soft accent halo. The
   halo is what marks it as THE action on the page, so using it twice in one view defeats
   it. Secondary is the accent outline that sits beside it. Quiet is the ghost for a
   third, low-stakes action.

   Nothing translates or scales on press: active darkens the fill and tightens the halo
   back to its resting size. */
const SIZES = {
  sm: {
    padding: '9px 16px',
    fontSize: '12.5px'
  },
  md: {
    padding: '11px 18px',
    fontSize: '13px'
  },
  lg: {
    padding: '13px 22px',
    fontSize: '14px'
  }
};
function Button({
  children,
  variant = 'primary',
  size = 'md',
  shape = 'rect',
  danger = false,
  disabled = false,
  full = false,
  onClick,
  title,
  style
}) {
  const s = SIZES[size] || SIZES.md;
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const solid = variant === 'primary';
  let bg = 'transparent';
  let fg = 'var(--accent)';
  let bc = 'var(--accent)';
  let weight = 700;
  let shadow = undefined;
  if (solid) {
    bg = hover || down ? 'var(--blue-600)' : 'var(--accent)';
    fg = '#ffffff';
    bc = hover || down ? 'var(--blue-600)' : 'var(--accent)';
    shadow = hover && !down ? 'var(--ring-action-hover)' : 'var(--ring-action)';
  } else if (variant === 'quiet') {
    bc = hover ? 'var(--blue-200)' : 'transparent';
    bg = hover ? 'var(--blue-50)' : 'transparent';
  } else {
    bg = hover ? 'var(--blue-50)' : 'transparent';
  }
  if (danger) {
    fg = 'var(--on-bad)';
    bc = 'var(--bad)';
    bg = hover ? 'var(--pill-bad)' : 'transparent';
    shadow = undefined;
  }
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setDown(false);
    },
    onMouseDown: () => setDown(true),
    onMouseUp: () => setDown(false),
    title: title,
    disabled: disabled,
    style: {
      display: full ? 'block' : 'inline-flex',
      width: full ? '100%' : undefined,
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: s.padding,
      fontSize: s.fontSize,
      fontFamily: 'var(--font-core)',
      fontWeight: weight,
      letterSpacing: '-0.01em',
      lineHeight: 1.2,
      color: fg,
      background: bg,
      border: '1px solid ' + bc,
      borderRadius: 'var(--r)',
      boxShadow: disabled ? 'none' : shadow,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      whiteSpace: 'nowrap',
      transition: 'background var(--dur), border-color var(--dur), box-shadow var(--dur)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
/* One shadow for the whole product, one radius. Shape no longer signals element type,
   so a card that needs to read as a STATE takes its fill and border from the same tone
   family, with that family's own foreground. Never mix families; never alpha-mute text
   on a tint.

   Tint 100 is the card the reader should reach first — one per screen.
   Selected is the card they have actively selected — one at a time, by definition.
   The two are not interchangeable and must not both land on the same card. */
const PAD = {
  none: '0',
  card: 'var(--pad-card)',
  wide: '18px 20px',
  lead: '20px 22px',
  bar: '14px 18px',
  list: '6px 18px'
};
const STATES = {
  default: {
    background: 'var(--surf)',
    borderColor: 'var(--border)'
  },
  emphasised: {
    background: 'var(--blue-100)',
    borderColor: 'var(--blue-200)',
    color: 'var(--on-tint-value)'
  },
  selected: {
    background: 'var(--surf)',
    borderColor: 'var(--accent)',
    ring: true
  },
  urgent: {
    background: 'var(--pill-bad)',
    borderColor: 'var(--bad)',
    color: 'var(--on-bad)'
  },
  due: {
    background: 'var(--pill-warn)',
    borderColor: 'var(--warn)',
    color: 'var(--on-warn)'
  },
  positive: {
    background: 'var(--pill-good)',
    borderColor: 'var(--good)',
    color: 'var(--on-good)'
  }
};

/* Legacy border-only emphasis, kept so existing markup keeps working. New work should
   use `state` instead — a tinted border reads at a glance where a faint one does not. */
const ACCENTS = {
  accent: 'rgba(var(--accent-rgb), 0.3)',
  warn: 'rgba(var(--warn-rgb), 0.5)',
  bad: 'rgba(var(--bad-rgb), 0.4)',
  highlight: 'rgba(var(--highlight-rgb), 0.5)'
};
function Card({
  children,
  pad = 'card',
  state = 'default',
  accent,
  tint,
  scroll = false,
  minWidth,
  style
}) {
  const st = STATES[state] || STATES.default;
  const inner = scroll ? /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: minWidth || '600px'
    }
  }, children)) : children;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: tint || st.background,
      border: '1px solid ' + (accent ? ACCENTS[accent] || accent : st.borderColor),
      borderRadius: 'var(--r)',
      padding: PAD[pad] || pad,
      /* The ring is listed FIRST: box-shadow paints in order, so it must precede the
         ambient shadow to sit tight against the border edge. */
      boxShadow: st.ring ? 'var(--ring-select), var(--shadow)' : 'var(--shadow)',
      color: st.color,
      minWidth: 0,
      ...style
    }
  }, inner);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
/* Two active treatments, and the difference is deliberate. A filter chip changes what
   the screen contains, so its active state is solid. A date or session chip changes
   which record you are looking at, so its active state is a tint — it is a position in
   a set, not a filter. Do not unify them.

   The count is set apart by font and size, never by opacity: dimmed to 0.65 it measured
   under 3:1 on an inactive chip. Nothing in this system dims text with alpha. */
function Chip({
  children,
  active = false,
  variant = 'filter',
  count,
  disabled = false,
  onClick,
  style
}) {
  const tinted = variant === 'record';
  let bg = 'transparent';
  let fg = 'var(--muted)';
  let bc = 'var(--border)';
  if (active && tinted) {
    bg = 'var(--pill-accent)';
    fg = 'var(--accent)';
    bc = 'rgba(var(--accent-rgb), 0.55)';
  } else if (active) {
    bg = 'var(--accent)';
    fg = '#ffffff';
    bc = 'var(--accent)';
  } else if (tinted) {
    bg = 'var(--surf)';
    fg = 'var(--text)';
  }
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: disabled ? undefined : onClick,
    disabled: disabled,
    style: {
      fontFamily: 'var(--font-core)',
      fontSize: tinted ? '13.5px' : 'var(--t-label)',
      fontWeight: 600,
      padding: tinted ? '9px 20px' : '6px 14px',
      borderRadius: 'var(--r)',
      border: '1px solid ' + bc,
      background: bg,
      color: fg,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      whiteSpace: 'nowrap',
      transition: 'var(--t-state)',
      ...style
    }
  }, children, count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: '11px'
    }
  }, " ", count));
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
/* The 11px uppercase scope line that opens every Fydr screen and card section.
   It states scope, date and filter — the three things that make a number mean
   something. */
function Eyebrow({
  children,
  tone = 'muted',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--t-eyebrow)',
      fontWeight: 600,
      letterSpacing: 'var(--t-eyebrow-tracking)',
      textTransform: 'uppercase',
      color: tone === 'accent' ? 'var(--accent)' : tone === 'faint' ? 'var(--faint)' : 'var(--muted)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Pill.jsx
try { (() => {
/* A pill always pairs a tinted background with a darkened foreground. A semantic colour
   is never used as pill text — --warn on white fails contrast, which is why --on-warn
   exists. */
const TONES = {
  good: {
    bg: 'var(--pill-good)',
    fg: 'var(--on-good)'
  },
  warn: {
    bg: 'var(--pill-warn)',
    fg: 'var(--on-warn)'
  },
  bad: {
    bg: 'var(--pill-bad)',
    fg: 'var(--on-bad)'
  },
  accent: {
    bg: 'var(--pill-accent)',
    fg: 'var(--accent)'
  },
  highlight: {
    bg: 'var(--pill-highlight)',
    fg: 'var(--on-highlight)'
  },
  outline: {
    bg: 'transparent',
    fg: 'var(--muted)',
    bc: 'var(--border)'
  }
};
const SIZES = {
  sm: {
    fontSize: 'var(--t-pill-xs)',
    padding: '2px 8px'
  },
  md: {
    fontSize: 'var(--t-pill-sm)',
    padding: '2px 9px'
  },
  lg: {
    fontSize: 'var(--t-pill)',
    padding: '3px 10px'
  },
  xl: {
    fontSize: 'var(--t-pill)',
    padding: '4px 12px'
  }
};
function Pill({
  children,
  tone = 'outline',
  size = 'lg',
  style
}) {
  const t = TONES[tone] || TONES.outline;
  const s = SIZES[size] || SIZES.lg;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      fontFamily: 'var(--font-core)',
      fontSize: s.fontSize,
      fontWeight: 700,
      padding: s.padding,
      borderRadius: 'var(--r)',
      background: t.bg,
      color: t.fg,
      border: t.bc ? '1px solid ' + t.bc : 'none',
      whiteSpace: 'nowrap',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Pill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Pill.jsx", error: String((e && e.message) || e) }); }

// components/data/Dial.jsx
try { (() => {
/* The Fydr ring. r=40 in a 100x100 viewBox, 9px stroke, rotated -90deg so the arc
   starts at twelve o'clock. The circumference is 2*pi*40 = 251, which is why every
   dasharray in the product is 251.

   Anything measured against a ceiling passes that ceiling as `max` and gets a tick
   drawn at 100 — without it, 108% and 128% look the same.

   The value sits on a raised white plinth carrying --shadow-raised, the system's deeper
   raised level. It lifts the number clear of the ring behind it, which matters most on a
   full ring where the arc passes directly under the digits. The shadow is on the plinth,
   never on the text.

   The arc is dimensional rather than flat. Three things do that work:

   1. The track is a CHANNEL — hairline walls at its inner and outer edges, so it reads
      as cut into the card and the arc has something to sit in.
   2. The arc carries a tonal sweep along its length: the hue lightened at the start,
      full strength through the middle, a touch deeper at the end. This is the one graded
      fill in the system, and it is scoped to a 9px stroke — a sweep across an arc gives
      it direction and roundness, where a sweep behind a number is decoration the number
      then has to fight.
   3. A soft shadow under the arc lifts it off the channel floor.

   The sweep is derived with color-mix() from whatever `tone` is passed, so a caller can
   hand this component any colour and still get the dimensional read. */
const RING = 251;
function Dial({
  value,
  display,
  unit,
  size = 104,
  max = 100,
  tick = false,
  tone = 'var(--accent)',
  stroke = 9,
  style
}) {
  const empty = value == null;
  const pct = empty ? 0 : Math.min(1, Math.max(0, value / max));
  const offset = Math.round(RING * (1 - pct));
  const tickOffset = -Math.round(RING * (100 / max));
  /* useId carries colons, which are not valid inside a url(#...) reference */
  const uid = React.useId().split(':').join('');
  const gid = 'dial-sweep-' + uid;
  const fid = 'dial-lift-' + uid;
  const wall = stroke / 2;
  const lit = 'color-mix(in oklab, ' + tone + ' 58%, white)';
  const deep = 'color-mix(in oklab, ' + tone + ' 88%, black)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      flex: 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 100 100",
    style: {
      display: 'block',
      transform: 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: gid,
    gradientUnits: "userSpaceOnUse",
    x1: "0",
    y1: "0",
    x2: "100",
    y2: "100"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: lit
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "55%",
    stopColor: tone
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: deep
  })), /*#__PURE__*/React.createElement("filter", {
    id: fid,
    x: "-25%",
    y: "-25%",
    width: "150%",
    height: "150%"
  }, /*#__PURE__*/React.createElement("feDropShadow", {
    dx: "0",
    dy: "1.1",
    stdDeviation: "1.1",
    floodColor: "rgb(23,40,80)",
    floodOpacity: "0.34"
  }))), /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "50",
    r: "40",
    fill: "none",
    stroke: "var(--track)",
    strokeWidth: stroke
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "50",
    r: 40 - wall,
    fill: "none",
    stroke: "rgba(23,40,80,0.1)",
    strokeWidth: "0.6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "50",
    r: 40 + wall,
    fill: "none",
    stroke: "rgba(23,40,80,0.07)",
    strokeWidth: "0.6"
  }), !empty && /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "50",
    r: "40",
    fill: "none",
    stroke: 'url(#' + gid + ')',
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeDasharray: RING,
    filter: 'url(#' + fid + ')',
    style: {
      animation: 'ring-in var(--dur-ring) var(--ease-ring)',
      strokeDashoffset: offset
    }
  }), tick && /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "50",
    r: "40",
    fill: "none",
    stroke: "var(--tick)",
    strokeWidth: stroke + 2,
    strokeDasharray: "2 249",
    style: {
      strokeDashoffset: tickOffset
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surf)',
      borderRadius: 'var(--r-round)',
      boxShadow: 'var(--shadow-raised)',
      width: size - stroke * 2 - 8,
      height: size - stroke * 2 - 8,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '3px',
      padding: '0 4px',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: size >= 100 ? 'var(--t-num-dial)' : size >= 80 ? 'var(--t-num-dial-sm)' : 'var(--t-num-body)',
      fontWeight: 500,
      lineHeight: 1,
      color: empty ? 'var(--faint)' : 'var(--text)'
    }
  }, empty ? '\u2014' : display != null ? display : value), unit && /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      fontSize: size >= 100 ? '10px' : '9px',
      lineHeight: 1.2,
      color: 'var(--faint)'
    }
  }, unit)))));
}
Object.assign(__ds_scope, { Dial });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Dial.jsx", error: String((e && e.message) || e) }); }

// components/data/DomainDot.jsx
try { (() => {
/* Compliance in 11px. Four states, and "not expected" is an outline rather than a
   colour — an athlete who was never asked has not missed anything. */
const STATES = {
  done: {
    bg: 'var(--good)',
    bc: 'var(--good)',
    label: 'Submitted'
  },
  due: {
    bg: 'var(--warn)',
    bc: 'var(--warn)',
    label: 'Due'
  },
  missed: {
    bg: 'var(--bad)',
    bc: 'var(--bad)',
    label: 'Missed'
  },
  none: {
    bg: 'transparent',
    bc: 'var(--line-strong)',
    label: 'Not expected'
  }
};
function DomainDot({
  state = 'none',
  size = 11,
  title,
  style
}) {
  const s = STATES[state] || STATES.none;
  return /*#__PURE__*/React.createElement("span", {
    title: title || s.label,
    style: {
      width: size,
      height: size,
      flex: 'none',
      display: 'inline-block',
      borderRadius: 'var(--r-round)',
      background: s.bg,
      border: '1px solid ' + s.bc,
      ...style
    }
  });
}
Object.assign(__ds_scope, { DomainDot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DomainDot.jsx", error: String((e && e.message) || e) }); }

// components/data/MeterBar.jsx
try { (() => {
/* A labelled progress bar. Where a target lives below the maximum, pass `tickAt` and
   the fill is scaled so the target sits at that position — a bar pinned at full width
   cannot show by how much a plan overshoots. */
function MeterBar({
  label,
  value,
  display,
  max = 100,
  tickAt,
  tone = 'var(--accent)',
  height = 6,
  foot,
  style
}) {
  const ratio = max ? value / max : 0;
  const width = tickAt != null ? Math.min(100, ratio * tickAt) : Math.min(100, Math.max(0, ratio * 100));
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, (label || display != null) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: '10px',
      alignItems: 'baseline'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      fontWeight: 600
    }
  }, label), display != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-meta)',
      color: tone
    }
  }, display)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: height + 4,
      marginTop: '6px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: '2px 0',
      borderRadius: 'var(--r)',
      background: 'var(--track)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '2px',
      bottom: '2px',
      left: 0,
      borderRadius: 'var(--r)',
      width: width + '%',
      background: tone
    }
  }), tickAt != null && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: '2px',
      background: 'var(--tick)',
      left: tickAt + '%'
    }
  })), foot && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-micro)',
      color: 'var(--faint)',
      marginTop: '4px'
    }
  }, foot));
}
Object.assign(__ds_scope, { MeterBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MeterBar.jsx", error: String((e && e.message) || e) }); }

// components/data/RangeBar.jsx
try { (() => {
/* A value against an acceptable band: body mass in a target range, a session against
   its normal, a benchmark percentile. The axis pads the band by 40% of its own width
   either side, so a marker outside the band still lands on screen. */
function RangeBar({
  value,
  low,
  high,
  tone = 'var(--accent)',
  pad = 0.4,
  height = 12,
  label,
  style
}) {
  const span = high - low;
  const lo = low - span * pad;
  const hi = high + span * pad;
  const total = hi - lo || 1;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: height / 3 + 'px 0',
      borderRadius: 'var(--r)',
      background: 'var(--track)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: height / 3 + 'px',
      bottom: height / 3 + 'px',
      borderRadius: 'var(--r)',
      background: 'rgba(var(--accent-rgb), 0.16)',
      left: (low - lo) / total * 100 + '%',
      width: span / total * 100 + '%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: '3px',
      borderRadius: 'var(--r)',
      background: tone,
      left: clamp((value - lo) / total * 100, 1, 99) + '%',
      transform: 'translateX(-50%)'
    }
  })), label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: '10px',
      color: 'var(--faint)',
      marginTop: '2px'
    }
  }, label));
}
Object.assign(__ds_scope, { RangeBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/RangeBar.jsx", error: String((e && e.message) || e) }); }

// components/data/Sparkline.jsx
try { (() => {
/* A trend as an inline SVG, stretched to its container. preserveAspectRatio="none" is
   what lets one drawing serve a 300px table cell and a 600px card — but it also scales
   stroke widths unevenly, so every stroke here carries vectorEffect="non-scaling-stroke"
   and renders at its true weight whatever the container does.

   Two forms, because a GPS session and a body mass are different kinds of quantity:

   - `columns` (the default) — one column per session, coloured by where it fell against
     the band. Sessions are discrete events, and this is the only form where a coach can
     point at one and say "that Tuesday".
   - `line` — a continuous path for a quantity that genuinely flows: body mass, a rolling
     load. Single tone throughout; the band does the work of saying what is normal. Do
     not colour the line by band — a path that changes colour mid-stroke reads as two
     series.

   Columns stop working below about 6px per session, where they become gapless slivers.
   Rather than render that, the component falls back to the line automatically — pass
   `variant="columns"` and trust it. Set `minColumnWidth` to tune the threshold.

   The normal band is drawn as a tinted region between two dashed edges. The edges are
   the point: a flat tint alone reads as decoration, and a coach cannot tell whether a
   value is inside it or merely near it.

   For a lower-is-better series pass `invert` so improvement still draws upward. */
const VH = 90;
function Sparkline({
  points = [],
  width = 600,
  height = 62,
  band,
  variant = 'columns',
  invert = false,
  tone = 'var(--accent2)',
  fill = 'rgba(var(--accent2-rgb), 0.14)',
  dot = true,
  dotTone,
  padLo = 0.08,
  padHi = 0.06,
  minColumnWidth = 6,
  style
}) {
  if (!points.length) return null;
  const all = band ? points.concat([band.low, band.high]) : points;
  const min = Math.min.apply(null, all) * (1 - padLo);
  const max = Math.max.apply(null, all) * (1 + padHi);
  const span = max - min || 1;
  const y = v => invert ? 8 + (v - min) / span * (VH - 16) : VH - 8 - (v - min) / span * (VH - 16);
  const x = i => Math.round(i / (points.length - 1 || 1) * width);
  const slot = width / points.length;
  const asColumns = variant === 'columns' && slot >= minColumnWidth;
  const bandTone = v => {
    if (!band) return tone;
    if (v > band.high) return 'var(--warn)';
    if (v < band.low) return 'var(--accent2)';
    return 'var(--accent)';
  };
  let line = '';
  points.forEach((v, i) => {
    line += (i ? ' L' : 'M') + x(i) + ' ' + y(v).toFixed(1);
  });
  const area = line + ' L' + width + ' ' + VH + ' L0 ' + VH + ' Z';
  const last = points[points.length - 1];
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: '0 0 ' + width + ' ' + VH,
    preserveAspectRatio: "none",
    style: {
      display: 'block',
      width: '100%',
      height,
      ...style
    }
  }, band && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: y(band.high),
    width: width,
    height: Math.max(2, y(band.low) - y(band.high)),
    fill: 'rgba(var(--accent-rgb), ' + (asColumns ? 0.1 : 0.14) + ')'
  }), /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: y(band.high),
    x2: width,
    y2: y(band.high),
    stroke: "rgba(var(--accent-rgb), 0.5)",
    strokeWidth: "1",
    strokeDasharray: "4 4",
    vectorEffect: "non-scaling-stroke"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: y(band.low),
    x2: width,
    y2: y(band.low),
    stroke: "rgba(var(--accent-rgb), 0.5)",
    strokeWidth: "1",
    strokeDasharray: "4 4",
    vectorEffect: "non-scaling-stroke"
  })), asColumns ? points.map((v, i) => {
    const w = Math.max(1, slot - Math.min(6, slot * 0.28));
    const top = y(v);
    return /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: (i * slot + (slot - w) / 2).toFixed(1),
      y: top.toFixed(1),
      width: w.toFixed(1),
      height: Math.max(1, VH - 8 - top).toFixed(1),
      rx: "2",
      fill: bandTone(v)
    });
  }) : /*#__PURE__*/React.createElement("g", null, !band && /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: fill
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: tone,
    strokeWidth: "2.4",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    vectorEffect: "non-scaling-stroke"
  }), dot && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: width,
    cy: y(last),
    r: "5.5",
    fill: "var(--surf)"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: width,
    cy: y(last),
    r: "3.5",
    fill: dotTone || tone
  }))));
}
Object.assign(__ds_scope, { Sparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Sparkline.jsx", error: String((e && e.message) || e) }); }

// components/data/StatBar.jsx
try { (() => {
/* The headline stat row. Each stat is its own tile with its own border, radius and
   shadow, separated by a real gap — they are independent readings joined from separate
   domains, not columns of one table, and flush cells divided by hairlines made them
   look like a single row that had been subdivided. Wraps rather than scrolling.

   Every cell states a value, what it counts, and its denominator.

   A cell can carry a `state`, which tints it and takes its value ink from the same tone
   family. There are two legitimate ways to use it, and mixing them is what goes wrong:

   1. **One tinted tile** in an otherwise neutral row — the number to look at first.
   2. **Every tile tinted**, each carrying its own condition. The row becomes a status
      board: urgent / emphasised / positive / due read as four distinct states rather
      than four levels of the same one.

   What does not work is tinting some arbitrary subset, where the untinted tiles look
   unfinished rather than calm. A tinted tile supplies its own ink, so do not also pass
   `tone`.

   A tinted tile is shaded rather than flat: a full-strength rule along its top edge, and
   an inset highlight under it so the tint reads as a panel. The shading is inset shadow,
   not a gradient — the system has no gradients, and a graded fill behind a column of
   numbers is the thing those numbers then have to fight. */
const STATES = {
  emphasised: {
    bg: 'var(--blue-100)',
    bc: 'var(--blue-200)',
    ink: 'var(--on-tint-value)',
    meta: 'var(--on-tint-meta)',
    edge: 'var(--accent)'
  },
  urgent: {
    bg: 'var(--pill-bad)',
    bc: 'var(--bad)',
    ink: 'var(--on-bad)',
    meta: 'var(--on-bad-meta)',
    edge: 'var(--bad)'
  },
  due: {
    bg: 'var(--pill-warn)',
    bc: 'var(--warn)',
    ink: 'var(--on-warn)',
    meta: 'var(--on-warn-meta)',
    edge: 'var(--warn)'
  },
  positive: {
    bg: 'var(--pill-good)',
    bc: 'var(--good)',
    ink: 'var(--on-good)',
    meta: 'var(--on-good-meta)',
    edge: 'var(--good)'
  }
};
function StatBar({
  stats = [],
  basis = '168px',
  onSelect,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--gap-tile, 12px)',
      ...style
    }
  }, stats.map((s, i) => {
    const st = STATES[s.state];
    return /*#__PURE__*/React.createElement("div", {
      key: s.label + i,
      onClick: onSelect ? () => onSelect(s, i) : undefined,
      style: {
        position: 'relative',
        overflow: 'hidden',
        flex: '1 1 ' + basis,
        minWidth: 0,
        padding: st ? '19px 20px 18px' : '18px 20px',
        background: st ? st.bg : 'var(--surf)',
        border: '1px solid ' + (st ? st.bc : 'var(--border)'),
        borderRadius: 'var(--r)',
        boxShadow: st ? 'var(--shadow), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(23,40,80,0.05)' : 'var(--shadow)',
        cursor: onSelect ? 'pointer' : 'default'
      }
    }, st && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: st.edge
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--t-eyebrow)',
        fontWeight: st ? 700 : 600,
        letterSpacing: 'var(--t-eyebrow-tracking)',
        textTransform: 'uppercase',
        color: st ? st.meta : 'var(--faint)'
      }
    }, s.label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-num)',
        fontSize: 'var(--t-num-stat)',
        fontWeight: st ? 600 : 500,
        lineHeight: 'var(--lh-num)',
        letterSpacing: '-0.02em',
        marginTop: '7px',
        fontVariantNumeric: 'tabular-nums',
        color: st ? st.ink : s.tone || 'var(--text)'
      }
    }, s.value, s.unit && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '14px',
        color: st ? st.meta : 'var(--muted)'
      }
    }, s.unit)), s.sub && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--t-label)',
        color: st ? st.meta : 'var(--muted)',
        marginTop: '2px'
      }
    }, s.sub), s.foot && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--t-eyebrow)',
        color: st ? st.meta : 'var(--faint)',
        marginTop: '5px'
      }
    }, s.foot));
  }));
}
Object.assign(__ds_scope, { StatBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatBar.jsx", error: String((e && e.message) || e) }); }

// components/data/TableShell.jsx
try { (() => {
/* Every wide Fydr board is this: an overflow-x scroller around a min-width inner grid,
   with the first column sticky so names survive the scroll. Tables scroll; they never
   compress. */
function TableShell({
  columns = '',
  minWidth = '600px',
  head,
  children,
  caption,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: 'auto',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth
    }
  }, head && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: columns,
      gap: 'var(--gap-row)',
      padding: '0 6px 9px'
    }
  }, head.map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontSize: 'var(--t-colhead)',
      fontWeight: 600,
      letterSpacing: 'var(--t-colhead-tracking)',
      textTransform: 'uppercase',
      color: 'var(--faint)',
      textAlign: i === 0 ? 'left' : 'right',
      position: i === 0 ? 'sticky' : 'static',
      left: i === 0 ? 0 : undefined,
      background: i === 0 ? 'var(--surf)' : 'transparent',
      zIndex: i === 0 ? 2 : undefined
    }
  }, h))), children, caption && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border)',
      marginTop: '6px',
      padding: '12px 6px 0',
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-caption)',
      color: 'var(--muted)'
    }
  }, caption)));
}

/* A group heading inside a board — a positional unit, an age band, a day. */
function TableGroup({
  label,
  meta,
  columns,
  tone = 'var(--accent)'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--hair)',
      display: 'grid',
      gridTemplateColumns: columns || 'minmax(0, 1fr) auto',
      gap: '10px',
      alignItems: 'baseline',
      padding: '12px 6px 6px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-eyebrow)',
      fontWeight: 700,
      letterSpacing: 'var(--t-colhead-tracking)',
      textTransform: 'uppercase',
      color: tone,
      position: 'sticky',
      left: 0,
      background: 'var(--surf)',
      zIndex: 2
    }
  }, label), meta && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-eyebrow)',
      color: 'var(--faint)'
    }
  }, meta));
}

/* An athlete row. The first cell is sticky and must carry a matching background,
   otherwise the wash shows through the name on scroll.

   A shaded cell should name its BAND (`heat: 1-5` for load, `pct: 1-5` for percentage),
   not a background colour. The band then supplies its own ink — bands 4 and 5 are dark
   enough to need white, and passing `bg` alone silently leaves near-black text on navy.
   `bg`/`fg` remain for one-off cases, but must always be given as a pair. */
function TableRow({
  columns,
  cells = [],
  wash = 'transparent',
  selected = false,
  onClick,
  children
}) {
  const bg = selected ? 'var(--wash-accent)' : wash;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      borderTop: '1px solid var(--hair)',
      display: 'grid',
      gridTemplateColumns: columns,
      gap: 'var(--gap-row)',
      alignItems: 'center',
      padding: 'var(--pad-cell)',
      borderRadius: 'var(--r)',
      background: bg,
      cursor: onClick ? 'pointer' : 'default'
    }
  }, children || cells.map((c, i) => {
    const isName = i === 0;
    const val = c && typeof c === 'object' ? c : {
      text: c
    };
    let cellBg = val.bg;
    let cellFg = val.fg;
    if (val.heat) {
      cellBg = 'var(--heat-' + val.heat + ')';
      cellFg = cellFg || 'var(--heat-ink-' + val.heat + ')';
    } else if (val.pct) {
      cellBg = 'var(--heat-pct-' + val.pct + ')';
      cellFg = cellFg || 'var(--heat-pct-text)';
    }
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        textAlign: isName ? 'left' : 'right',
        position: isName ? 'sticky' : 'static',
        left: isName ? 0 : undefined,
        zIndex: isName ? 1 : undefined,
        background: isName ? bg === 'transparent' ? 'var(--surf)' : bg : cellBg || 'transparent',
        borderRadius: cellBg ? 'var(--r)' : undefined,
        padding: cellBg ? '6px 8px' : undefined,
        minWidth: 0,
        fontFamily: isName ? 'var(--font-core)' : 'var(--font-num)',
        fontWeight: isName ? 600 : cellBg ? 500 : 400,
        fontSize: isName ? '13.5px' : 'var(--t-num-cell)',
        fontVariantNumeric: isName ? 'normal' : 'tabular-nums',
        color: cellFg || 'var(--text)',
        overflow: isName ? 'hidden' : undefined,
        textOverflow: isName ? 'ellipsis' : undefined,
        whiteSpace: isName ? 'nowrap' : undefined
      }
    }, val.text);
  }));
}
Object.assign(__ds_scope, { TableShell, TableGroup, TableRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/TableShell.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SidebarNav.jsx
try { (() => {
/* The staff sidebar. Full-bleed: the nav carries no horizontal padding of its own, so
   the active marker can sit flush against the sidebar's left edge. Items pad themselves.

   The active state is a 3px accent bar on that left edge plus an accent label and icon —
   no tinted row behind it. In a list of eight destinations a filled row reads as a
   selected object; an edge marker reads as "you are here", which is what a sidebar is
   saying. Inactive labels stay at --text rather than dropping to --muted: they are
   destinations, not disabled ones, and only the marker and colour distinguish the
   current screen.

   Icons are Phosphor fill at 20px, passed as names ('users', 'barbell'). Fill rather
   than regular because at 20px in a dense list a stroked glyph goes weedy next to a
   15px semibold label. A node can be passed instead for anything the set lacks.

   Parents carry a chevron and their children indent behind a 2px rule; a section
   auto-expands when it contains the active screen. Gated destinations stay visible with
   a badge — a coach should be able to see what they are not buying. */
const PAD_X = '22px';
function Glyph({
  icon,
  tone
}) {
  if (!icon) return null;
  if (typeof icon !== 'string') {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 'none',
        width: 20,
        height: 20,
        display: 'grid',
        placeItems: 'center',
        color: tone
      }
    }, icon);
  }
  return /*#__PURE__*/React.createElement("i", {
    className: 'ph-fill ph-' + icon,
    style: {
      flex: 'none',
      fontSize: '20px',
      lineHeight: 1,
      color: tone,
      transition: 'color var(--dur)'
    }
  });
}
function SidebarNav({
  items = [],
  active,
  open = {},
  onSelect,
  onToggle,
  footer,
  style
}) {
  const isOpen = it => {
    if (open[it.key] !== undefined) return open[it.key];
    if (it.key === active) return true;
    return (it.children || []).some(c => c.key === active);
  };
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      ...style
    }
  }, items.map(it => {
    const expanded = (it.children || []).length > 0 && isOpen(it);
    const on = it.key === active;
    const ink = on ? 'var(--accent)' : 'var(--text)';
    return /*#__PURE__*/React.createElement("div", {
      key: it.key
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => onSelect && onSelect(it.key),
      style: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '11px ' + PAD_X,
        fontSize: 'var(--t-body)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'color var(--dur)',
        color: ink,
        opacity: it.locked ? 0.62 : 1
      }
    }, on && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '3px',
        background: 'var(--accent)'
      }
    }), /*#__PURE__*/React.createElement(Glyph, {
      icon: it.icon,
      tone: ink
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, it.label), it.badge != null && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontFamily: 'var(--font-num)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--on-bad)',
        background: 'var(--pill-bad)',
        borderRadius: 'var(--r)',
        padding: '1px 7px'
      }
    }, it.badge), it.locked && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontSize: 'var(--t-pill-xs)',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 'var(--r)',
        background: 'var(--pill-highlight)',
        color: 'var(--on-highlight)'
      }
    }, "Premium"), (it.children || []).length > 0 && it.badge == null && !it.locked && /*#__PURE__*/React.createElement("span", {
      onClick: e => {
        e.stopPropagation();
        onToggle && onToggle(it.key, !expanded);
      },
      style: {
        marginLeft: 'auto',
        fontSize: '9px',
        color: 'var(--faint)'
      }
    }, expanded ? '\u25BE' : '\u25B8')), expanded && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        padding: '2px 0 8px',
        marginLeft: '34px'
      }
    }, it.children.map(c => {
      const con = c.key === active;
      return /*#__PURE__*/React.createElement("div", {
        key: c.key,
        onClick: () => onSelect && onSelect(c.key),
        style: {
          fontSize: 'var(--t-body-2xs)',
          fontWeight: 600,
          padding: '6px 12px',
          cursor: 'pointer',
          borderLeft: '2px solid ' + (con ? 'var(--accent)' : 'var(--hair)'),
          marginLeft: c.depth ? '14px' : 0,
          color: con ? 'var(--accent)' : 'var(--muted)',
          transition: 'var(--t-state)'
        }
      }, c.label);
    })));
  }), footer);
}
Object.assign(__ds_scope, { SidebarNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SidebarNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
/* The athlete app's bottom tabs. Four for athletes, five for staff on a phone. The
   36px bottom padding clears the home indicator.

   A tab is a real icon over a label — both take the same colour, so the pair reads as
   one target. There is no pill, no fill and no underline behind the active tab: colour
   alone carries it, which keeps a 4-across bar from looking crowded at phone width.

   Inactive tabs use --tab-inactive, a dark navy rather than a grey. They are secondary,
   not disabled, and an athlete in a car park has to be able to hit the right one.

   `iconTone` overrides the icon colour only — the Gym tab carries --highlight, because
   highlight means gym everywhere else in the product. Use it sparingly; if every tab
   has its own colour, none of them reads as selected. */
function TabBar({
  tabs = [],
  active,
  onSelect,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(' + (tabs.length || 1) + ', 1fr)',
      background: 'var(--tabbar-bg)',
      borderTop: '1px solid var(--hair)',
      padding: 'var(--tabbar-pad)',
      backdropFilter: 'var(--bar-blur)',
      WebkitBackdropFilter: 'var(--bar-blur)',
      ...style
    }
  }, tabs.map(t => {
    const key = typeof t === 'string' ? t : t.key;
    const label = typeof t === 'string' ? t : t.label;
    const icon = typeof t === 'string' ? null : t.icon;
    const on = key === active;
    const ink = on ? 'var(--accent)' : 'var(--tab-inactive)';
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      onClick: () => onSelect && onSelect(key),
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        minHeight: 'var(--touch-min)',
        padding: '4px 0',
        cursor: 'pointer'
      }
    }, icon && (typeof icon === 'string' ? /*#__PURE__*/React.createElement("i", {
      className: 'ph ph-' + icon,
      style: {
        fontSize: '24px',
        lineHeight: 1,
        color: !on && t.iconTone ? t.iconTone : ink,
        transition: 'color var(--dur)'
      }
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: ink,
        display: 'grid',
        placeItems: 'center'
      }
    }, icon)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--t-label)',
        fontWeight: 700,
        lineHeight: 1,
        color: ink,
        transition: 'color var(--dur)'
      }
    }, label));
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/patterns/Banner.jsx
try { (() => {
/* A single-line notice about the state of the screen: an overlap, an unpublished
   change, a suppressed calculation, a data boundary. Tinted rather than solid, because
   it informs rather than interrupts. */
const TONES = {
  accent: {
    bg: 'rgba(var(--accent-rgb), 0.07)',
    bc: 'rgba(var(--accent-rgb), 0.3)',
    dot: 'var(--accent)'
  },
  warn: {
    bg: 'rgba(var(--warn-rgb), 0.1)',
    bc: 'rgba(var(--warn-rgb), 0.45)',
    dot: 'var(--warn)'
  },
  bad: {
    bg: 'rgba(var(--bad-rgb), 0.08)',
    bc: 'rgba(var(--bad-rgb), 0.4)',
    dot: 'var(--bad)'
  },
  good: {
    bg: 'rgba(var(--good-rgb), 0.12)',
    bc: 'rgba(var(--good-rgb), 0.4)',
    dot: 'var(--good)'
  },
  plain: {
    bg: 'var(--surf)',
    bc: 'var(--border)',
    dot: 'var(--good)'
  }
};
function Banner({
  tone = 'warn',
  dot = true,
  title,
  children,
  action,
  style
}) {
  const t = TONES[tone] || TONES.warn;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.bg,
      border: '1px solid ' + t.bc,
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      display: 'grid',
      gridTemplateColumns: (dot ? '8px ' : '') + 'minmax(0, 1fr)' + (action ? ' auto' : ''),
      gap: '12px',
      alignItems: 'center',
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 'var(--r-round)',
      background: t.dot
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body-xs)',
      fontWeight: 700
    }
  }, title, " "), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body-xs)',
      color: 'var(--muted)'
    }
  }, children)), action);
}
Object.assign(__ds_scope, { Banner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/Banner.jsx", error: String((e && e.message) || e) }); }

// components/patterns/EmptyState.jsx
try { (() => {
/* Saying nothing is wrong is as useful as saying something is. A dashed container
   reads as "nothing here yet", where a blank card reads as "failed to load". */
function EmptyState({
  title,
  detail,
  action,
  tone = 'dashed',
  style
}) {
  const solid = tone === 'confirm';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: solid ? '1px solid var(--border)' : '1px dashed var(--line-dashed)',
      borderRadius: 'var(--r)',
      padding: '20px',
      textAlign: 'center',
      background: solid ? 'var(--surf)' : 'transparent',
      ...style
    }
  }, solid && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-round)',
      background: 'var(--pill-good)',
      display: 'grid',
      placeItems: 'center',
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "var(--on-good)",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 10.5l4 4 8-9"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: solid ? '17px' : 'var(--t-body-xs)',
      fontWeight: solid ? 700 : 400,
      color: solid ? 'var(--text)' : 'var(--muted)',
      marginTop: solid ? '12px' : 0
    }
  }, title), detail && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: solid ? 'var(--font-core)' : 'var(--font-num)',
      fontSize: solid ? 'var(--t-body-xs)' : 'var(--t-num-caption)',
      color: solid ? 'var(--muted)' : 'var(--faint)',
      marginTop: '4px'
    }
  }, detail), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '14px'
    }
  }, action));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/patterns/FlagCard.jsx
try { (() => {
/* A threshold crossing. When the flag is a CARD the severity reads as a tinted fill and
   border from one tone family (§3); as a dense list ROW it keeps the 3px left bar, where
   a full tint would be too heavy. The evidence line is the point of the whole component
   — the actual dates and values that triggered it, with the baseline, so a coach can act
   without opening anything else. */
const SEV = {
  high: 'var(--bad)',
  medium: 'var(--warn)',
  low: 'var(--accent2)'
};
const FILL = {
  high: 'var(--pill-bad)',
  medium: 'var(--pill-warn)',
  low: 'var(--pill-accent)'
};
const INK = {
  high: 'var(--on-bad)',
  medium: 'var(--on-warn)',
  low: 'var(--accent)'
};
const META = {
  high: 'var(--on-bad-meta)',
  medium: 'var(--on-warn-meta)',
  low: 'var(--accent)'
};
function FlagCard({
  name,
  domain,
  domainTone = 'accent',
  unit,
  rule,
  evidence,
  raised,
  value,
  baseline,
  severity = 'medium',
  acknowledged = false,
  onAcknowledge,
  layout = 'card',
  style
}) {
  const tone = SEV[severity] || SEV.medium;
  const fill = FILL[severity] || FILL.medium;
  const ink = INK[severity] || INK.medium;
  const meta = META[severity] || META.medium;
  const inline = layout === 'inline';
  const head = /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '9px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: inline ? '13.5px' : 'var(--t-card-sm)',
      fontWeight: 700
    }
  }, name), domain && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-pill-xs)',
      fontWeight: 700,
      padding: '2px 9px',
      borderRadius: 'var(--r)',
      background: 'var(--pill-' + domainTone + ')',
      color: domainTone === 'accent' ? 'var(--accent)' : 'var(--on-' + domainTone + ')'
    }
  }, domain), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-pill)',
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: 'var(--r)',
      border: '1px solid var(--border)',
      color: 'var(--muted)'
    }
  }, unit), inline && value && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: '14px',
      fontWeight: 500,
      color: tone
    }
  }, value));
  const bodyBlock = /*#__PURE__*/React.createElement("div", null, head, rule && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body)',
      marginTop: '6px'
    }
  }, rule), evidence && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-caption)',
      color: 'var(--faint)',
      marginTop: '4px'
    }
  }, evidence));
  const ack = onAcknowledge && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAcknowledge,
    style: {
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--t-body-2xs)',
      fontWeight: 700,
      padding: inline ? '6px 13px' : '11px 18px',
      borderRadius: 'var(--r)',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      background: acknowledged ? 'transparent' : 'var(--accent)',
      color: acknowledged ? 'var(--muted)' : '#ffffff',
      border: '1px solid ' + (acknowledged ? 'var(--border)' : 'var(--accent)')
    }
  }, acknowledged ? 'Acknowledged' : 'Acknowledge');
  if (inline) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        borderLeft: '3px solid ' + tone,
        paddingLeft: '14px',
        opacity: acknowledged ? 0.5 : 1,
        ...style
      }
    }, bodyBlock, (raised || ack) && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '12px',
        alignItems: 'center',
        marginTop: '8px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-num)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 'var(--t-num-caption)',
        color: 'var(--faint)'
      }
    }, raised), ack));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: fill,
      border: '1px solid ' + tone,
      borderRadius: 'var(--r)',
      padding: '16px',
      boxShadow: 'var(--shadow)',
      color: ink,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: '16px',
      alignItems: 'center',
      opacity: acknowledged ? 0.5 : 1,
      ...style
    }
  }, bodyBlock, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontSize: 'var(--t-num-dial-sm)',
      fontVariantNumeric: 'tabular-nums',
      color: ink
    }
  }, value), baseline && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-eyebrow)',
      color: meta
    }
  }, baseline)), ack));
}
Object.assign(__ds_scope, { FlagCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/FlagCard.jsx", error: String((e && e.message) || e) }); }

// components/patterns/PageHeader.jsx
try { (() => {
/* Eyebrow, title, optional intro, optional actions. Every Fydr screen opens with this
   and the shape never varies. */
function PageHeader({
  eyebrow,
  title,
  intro,
  badge,
  actions,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: actions ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
      gap: '20px',
      alignItems: 'end',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", null, eyebrow && /*#__PURE__*/React.createElement(__ds_scope.Eyebrow, null, eyebrow), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '12px',
      flexWrap: 'wrap',
      marginTop: '6px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--t-page)',
      fontWeight: 800,
      letterSpacing: 'var(--t-page-tracking)',
      margin: 0
    }
  }, title), badge), intro && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--t-body-xs)',
      color: 'var(--muted)',
      margin: '8px 0 0',
      maxWidth: 'var(--prose-max)',
      textWrap: 'pretty'
    }
  }, intro)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      justifyContent: 'flex-end'
    }
  }, actions));
}
Object.assign(__ds_scope, { PageHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/PageHeader.jsx", error: String((e && e.message) || e) }); }

// components/patterns/ReadCard.jsx
try { (() => {
/* "The read" — a plain-language sentence about what the numbers mean, with the numbers
   themselves pushed to the right. It exists because a coach should not have to derive
   the conclusion from a table. */
function ReadCard({
  label = 'The read',
  headline,
  body,
  stats = [],
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surf)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r)',
      padding: 'var(--pad-card-lead)',
      boxShadow: 'var(--shadow)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: stats.length ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
      gap: '24px',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", null, label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-eyebrow)',
      fontWeight: 600,
      letterSpacing: 'var(--t-eyebrow-tracking)',
      textTransform: 'uppercase',
      color: 'var(--faint)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-subhead)',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      marginTop: '8px',
      textWrap: 'pretty'
    }
  }, headline), body && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-sm)',
      color: 'var(--muted)',
      marginTop: '6px',
      maxWidth: '72ch'
    }
  }, body), children), stats.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '22px',
      paddingLeft: '24px',
      borderLeft: '1px solid var(--hair)'
    }
  }, stats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-micro)',
      fontWeight: 600,
      letterSpacing: 'var(--t-colhead-tracking)',
      textTransform: 'uppercase',
      color: 'var(--faint)'
    }
  }, s.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontSize: '23px',
      fontWeight: 500,
      lineHeight: 1.2,
      marginTop: '5px',
      fontVariantNumeric: 'tabular-nums',
      color: s.tone || 'var(--text)'
    }
  }, s.value, s.unit && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-label)',
      color: 'var(--muted)'
    }
  }, s.unit)), s.foot && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-micro)',
      color: 'var(--faint)',
      marginTop: '2px'
    }
  }, s.foot))))));
}
Object.assign(__ds_scope, { ReadCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/ReadCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/athlete_app/MyDataScreen.jsx
try { (() => {
const TABS = ['Wellness', 'Gym', 'Nutrition', 'Tests'];
const SERIES = {
  Wellness: [62, 71, 68, 80, 74, 66, 58, 72, 79, 83, 77, 70, 64, 76],
  Gym: [76, 64, 70, 77, 83, 79, 72, 58, 66, 74, 80, 68, 71, 62],
  Nutrition: [68, 80, 74, 66, 58, 72, 79, 83, 77, 70, 64, 76, 62, 71],
  Tests: [1.79, 1.78, 1.76, 1.75, 1.74, 1.72]
};
const HISTORY = {
  Wellness: [['Wed 5 Aug', '\u2014 not submitted', 'prompt sent 07:00', 'Due', 'var(--faint)'], ['Tue 4 Aug', 'Readiness 76', 'sleep 8.0 h \u00b7 soreness 3', 'Self', 'var(--text)'], ['Mon 3 Aug', 'Readiness 70', 'sleep 6.5 h \u00b7 soreness 2', 'Self', 'var(--text)'], ['Sun 2 Aug', 'Readiness 83', 'sleep 9.0 h \u00b7 soreness 4', 'Self', 'var(--text)']],
  Gym: [['Mon 3 Aug', 'Lower body A', '12 of 12 sets \u00b7 RPE 8', 'Self', 'var(--text)'], ['Fri 31 Jul', 'Upper body B', '9 of 9 sets \u00b7 RPE 7', 'Self', 'var(--text)'], ['Wed 29 Jul', 'Lower body A', '10 of 12 sets \u00b7 RPE 9', 'Self', 'var(--on-warn-strong)']],
  Nutrition: [['Tue 4 Aug', '3,050 kcal', 'target 3,200 \u00b7 protein 186 g', 'Self', 'var(--text)'], ['Mon 3 Aug', '\u2014 not submitted', 'reminder sent 20:00', 'Due', 'var(--faint)'], ['Sun 2 Aug', '2,780 kcal', 'target 2,900 \u00b7 protein 172 g', 'Self', 'var(--text)']],
  Tests: [['Jul 2026', '1.72 s', '10 m sprint \u00b7 best of 3', 'Staff', 'var(--text)'], ['Mar 2026', '1.75 s', '10 m sprint \u00b7 best of 3', 'Staff', 'var(--text)'], ['Sep 2025', '1.79 s', '10 m sprint \u00b7 best of 3', 'Staff', 'var(--text)']]
};
const CAPTION = {
  Wellness: 'Computed on write from 5 scales and sleep \u00b7 2 days not submitted, excluded',
  Gym: 'Sets \u00d7 reps \u00d7 load, self-reported \u00b7 1 session part logged',
  Nutrition: 'Self-reported \u00b7 5 days not submitted, excluded from the mean',
  Tests: 'Best of three attempts \u00b7 timing gates \u00b7 staff entered'
};
function MyDataScreen() {
  const [tab, setTab] = React.useState('Wellness');
  const lower = tab === 'Tests';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 18px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--gap-chip)',
      flexWrap: 'wrap'
    }
  }, TABS.map(t => /*#__PURE__*/React.createElement(__ds_scope.Chip, {
    key: t,
    active: t === tab,
    onClick: () => setTab(t)
  }, t))), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "card",
    style: {
      marginTop: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-card-sm)',
      fontWeight: 700
    }
  }, tab === 'Wellness' ? 'Readiness' : tab === 'Gym' ? 'Session load' : tab === 'Nutrition' ? 'Energy against target' : '10 m sprint'), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-caption)',
      color: 'var(--muted)'
    }
  }, lower ? 'last 6 tests' : 'last 14 days')), /*#__PURE__*/React.createElement(__ds_scope.Sparkline, {
    points: SERIES[tab],
    width: 300,
    height: 84,
    invert: lower,
    tone: "var(--accent2)",
    style: {
      marginTop: '14px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--hair)',
      marginTop: '12px',
      paddingTop: '10px',
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-eyebrow)',
      color: 'var(--muted)'
    }
  }, CAPTION[tab])), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "none",
    style: {
      marginTop: '14px',
      overflow: 'hidden'
    }
  }, HISTORY[tab].map(([date, value, detail, source, fg]) => /*#__PURE__*/React.createElement("div", {
    key: date,
    style: {
      display: 'grid',
      gridTemplateColumns: '74px minmax(0, 1fr) auto',
      gap: '10px',
      alignItems: 'center',
      padding: '13px 14px',
      borderTop: '1px solid var(--hair)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-body-2xs)',
      color: 'var(--muted)'
    }
  }, date), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body)',
      fontWeight: 600,
      color: fg
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-num-caption)',
      color: 'var(--faint)'
    }
  }, detail)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-micro)',
      fontWeight: 700,
      padding: '3px 9px',
      borderRadius: 'var(--r)',
      border: '1px solid var(--border)',
      color: 'var(--muted)'
    }
  }, source)))));
}
Object.assign(__ds_scope, { MyDataScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/athlete_app/MyDataScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/athlete_app/Phone.jsx
try { (() => {
/* The device frame. 402pt wide, which is the iPhone width the athlete app is authored
   against. Purely a viewing aid — do not port it. */
function Phone({
  children,
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px'
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-eyebrow)',
      fontWeight: 600,
      letterSpacing: 'var(--t-eyebrow-tracking)',
      textTransform: 'uppercase',
      color: 'var(--faint)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 402,
      height: 812,
      borderRadius: 46,
      background: '#0b0e18',
      padding: 11,
      boxShadow: '0 18px 50px rgba(16,18,23,0.22)',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      borderRadius: 36,
      overflow: 'hidden',
      background: 'var(--bg)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 9,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 108,
      height: 26,
      borderRadius: 20,
      background: '#0b0e18',
      zIndex: 60
    }
  }), children)));
}
Object.assign(__ds_scope, { Phone });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/athlete_app/Phone.jsx", error: String((e && e.message) || e) }); }

// ui_kits/athlete_app/TodayScreen.jsx
try { (() => {
const STRIP = [['M', 3, 'MD-5'], ['T', 4, 'MD-4'], ['W', 5, 'MD-3'], ['T', 6, 'MD-2'], ['F', 7, 'MD-1'], ['S', 8, 'MD'], ['S', 9, 'MD+1']];

/* Each task carries a real Phosphor glyph rather than a three-letter mono tag. The tags
   were placeholders standing in for icons, and an athlete reading "WEL" at 07:00 has to
   decode it. The tinted tile behind each glyph keeps the domain colour. */
const TODOS = [{
  key: 'wellness',
  icon: 'heartbeat',
  name: 'Wellness',
  sub: '45 seconds \u00b7 open since 07:00',
  pill: 'Due',
  tone: 'warn',
  iconBg: 'var(--pill-accent)',
  iconFg: 'var(--accent)'
}, {
  key: 'gym',
  icon: 'barbell',
  name: 'Lower body A',
  sub: 'Started 17:12 \u00b7 resume',
  pill: '3 of 12',
  tone: 'accent',
  iconBg: 'var(--pill-highlight)',
  iconFg: 'var(--on-highlight)'
}, {
  key: 'rpe',
  icon: 'gauge',
  name: 'Team run',
  sub: 'Due by 19:45 \u00b7 20 seconds',
  pill: 'Due',
  tone: 'warn',
  iconBg: 'rgba(var(--accent2-rgb), 0.16)',
  iconFg: 'var(--on-good)'
}];
function TodayScreen({
  done,
  onOpen
}) {
  const outstanding = TODOS.filter(t => !done[t.key]);
  const clear = outstanding.length === 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 18px 18px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "none",
    style: {
      padding: '12px 6px',
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '2px'
    }
  }, STRIP.map(([dow, dom, md]) => {
    const today = dom === 5;
    return /*#__PURE__*/React.createElement("div", {
      key: dom,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        padding: '4px 0',
        borderRadius: 'var(--r)',
        background: today ? 'rgba(var(--accent-rgb), 0.06)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--t-micro)',
        fontWeight: 600,
        color: 'var(--faint)'
      }
    }, dow), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 28,
        height: 28,
        borderRadius: 'var(--r-round)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--font-num)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 'var(--t-body-xs)',
        background: today ? 'var(--accent)' : 'transparent',
        color: today ? '#ffffff' : 'var(--text)'
      }
    }, dom), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-num)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 'var(--t-num-nano)',
        color: md === 'MD' ? 'var(--bad)' : md === 'MD-1' ? 'var(--accent)' : 'var(--faint)'
      }
    }, md));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(var(--warn-rgb), 0.12)',
      border: '1px solid rgba(var(--warn-rgb), 0.4)',
      borderRadius: 'var(--r)',
      padding: '14px',
      marginTop: '14px',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 14px',
      gap: '10px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 'var(--r-round)',
      border: '3px solid var(--warn)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body)',
      fontWeight: 700
    }
  }, "Modified")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-xs)',
      marginTop: '5px'
    }
  }, "No contact \xB7 no sprinting"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-label)',
      color: 'var(--muted)',
      marginTop: '2px'
    }
  }, "Speak to medical staff.")), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontSize: '16px'
    }
  }, "\u203A")), clear ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '16px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "none",
    style: {
      padding: '28px 18px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.EmptyState, {
    tone: "confirm",
    title: "You're up to date.",
    detail: 'Wellness, gym and RPE submitted today.'
  })), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "none",
    style: {
      padding: '14px',
      marginTop: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-eyebrow)',
      fontWeight: 600,
      letterSpacing: 'var(--t-eyebrow-tracking)',
      textTransform: 'uppercase',
      color: 'var(--faint)'
    }
  }, "Next up"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body)',
      fontWeight: 600,
      marginTop: '6px'
    }
  }, "Sat 8 Aug \xB7 MD \xB7 kick-off 14:00"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      color: 'var(--muted)'
    }
  }, "v Ashfield RFC \xB7 home \xB7 meet 12:15"))) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px',
      margin: '22px 2px 8px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-card-sm)',
      fontWeight: 700
    }
  }, "To do"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-body-xs)',
      color: 'var(--on-warn-strong)'
    }
  }, outstanding.length)), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "none",
    style: {
      overflow: 'hidden'
    }
  }, outstanding.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.key,
    onClick: () => onOpen(t.key),
    style: {
      display: 'grid',
      gridTemplateColumns: '38px minmax(0, 1fr) auto 12px',
      gap: '12px',
      alignItems: 'center',
      padding: '15px 14px',
      borderTop: '1px solid var(--hair)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r)',
      display: 'grid',
      placeItems: 'center',
      background: t.iconBg
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: 'ph-fill ph-' + t.icon,
    style: {
      fontSize: '20px',
      lineHeight: 1,
      color: t.iconFg
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-num-body)',
      fontWeight: 600
    }
  }, t.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      color: 'var(--muted)'
    }
  }, t.sub)), /*#__PURE__*/React.createElement(__ds_scope.Pill, {
    tone: t.tone,
    size: "lg"
  }, t.pill), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontSize: '16px'
    }
  }, "\u203A"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px',
      margin: '22px 2px 8px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-card-sm)',
      fontWeight: 700
    }
  }, "Today"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-label)',
      color: 'var(--muted)'
    }
  }, "MD-3")), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "none",
    style: {
      overflow: 'hidden'
    }
  }, [['09:00', 'Team run', 'Pitch 1 \u00b7 45 min', done.rpe ? '\u2713 RPE 6.0 submitted' : 'RPE due by 19:45', done.rpe], ['16:30', 'Lower body A', 'Main gym \u00b7 55 min', done.gym ? '\u2713 Logged' : '3 of 12 sets logged', done.gym]].map(([time, name, where, state, ok]) => /*#__PURE__*/React.createElement("div", {
    key: time,
    style: {
      padding: '14px',
      borderTop: '1px solid var(--hair)',
      display: 'grid',
      gridTemplateColumns: '54px minmax(0, 1fr)',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-body-xs)'
    }
  }, time), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-num-body)',
      fontWeight: 600
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-eyebrow)',
      color: 'var(--muted)'
    }
  }, "MD-3")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      color: 'var(--muted)',
      marginTop: '2px'
    }
  }, where), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-label)',
      fontWeight: 600,
      marginTop: '6px',
      color: ok ? 'var(--on-good)' : 'var(--on-warn-strong)'
    }
  }, state))))));
}
Object.assign(__ds_scope, { TodayScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/athlete_app/TodayScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/athlete_app/WellnessSheet.jsx
try { (() => {
/* The 45-second flow. Five coarse scales and a sleep stepper, and the submit button
   states how many answers remain rather than silently doing nothing. */
const SCALES = [{
  key: 'quality',
  label: 'Sleep quality',
  low: 'Very poor',
  high: 'Very good',
  words: ['Very poor', 'Poor', 'Ok', 'Good', 'Very good']
}, {
  key: 'fatigue',
  label: 'Fatigue',
  low: 'Exhausted',
  high: 'Very fresh',
  words: ['Exhausted', 'Tired', 'Ok', 'Fresh', 'Very fresh']
}, {
  key: 'soreness',
  label: 'Soreness',
  low: 'Very sore',
  high: 'No soreness',
  words: ['Very sore', 'Sore', 'Ok', 'Mild', 'None'],
  where: true
}, {
  key: 'stress',
  label: 'Stress',
  low: 'Very stressed',
  high: 'Very relaxed',
  words: ['Very stressed', 'Stressed', 'Ok', 'Calm', 'Very relaxed']
}, {
  key: 'mood',
  label: 'Mood',
  low: 'Very low',
  high: 'Very good',
  words: ['Very low', 'Low', 'Ok', 'Good', 'Very good']
}];
function WellnessSheet({
  onClose,
  onSubmit
}) {
  const [sleep, setSleep] = React.useState(7.5);
  const [vals, setVals] = React.useState({
    quality: null,
    fatigue: 4,
    soreness: 2,
    stress: null,
    mood: null
  });
  const answered = SCALES.filter(s => vals[s.key] != null).length;
  const ready = answered === 5;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--scrim)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surf)',
      borderRadius: 'var(--r-sheet)',
      height: '92%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      padding: '8px 0 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 4,
      borderRadius: 'var(--r)',
      background: 'var(--line-strong)',
      margin: '0 auto'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '30px minmax(0, 1fr) auto',
      gap: '10px',
      alignItems: 'center',
      padding: '12px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      fontSize: '19px',
      color: 'var(--muted)',
      cursor: 'pointer'
    }
  }, "\xD7"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-card)',
      fontWeight: 700,
      textAlign: 'center'
    }
  }, "Morning check-in"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-label)',
      color: 'var(--muted)'
    }
  }, "Wed 5 Aug")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 12px',
      fontSize: 'var(--t-body-2xs)',
      color: 'var(--muted)',
      borderBottom: '1px solid var(--hair)'
    }
  }, "On every scale, 5 is the best you can feel.")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '14px 16px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surf2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r)',
      padding: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body)',
      fontWeight: 700
    }
  }, "Sleep"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-body)'
    }
  }, sleep.toFixed(1), " h")), /*#__PURE__*/React.createElement(__ds_scope.Stepper, {
    size: "lg",
    value: sleep.toFixed(1),
    unit: "hours",
    step: 0.5,
    min: 0,
    max: 14,
    onChange: v => setSleep(v),
    style: {
      marginTop: '10px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-eyebrow)',
      fontWeight: 600,
      padding: '4px 10px',
      borderRadius: 'var(--r)',
      background: 'var(--surf)',
      border: '1px solid var(--border)',
      color: 'var(--muted)',
      display: 'inline-block',
      marginTop: '10px'
    }
  }, "Last night\u2019s entry: 8.0")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      marginTop: '18px'
    }
  }, SCALES.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.key
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body)',
      fontWeight: 700
    }
  }, s.label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      fontWeight: 600,
      color: vals[s.key] == null ? 'var(--faint)' : 'var(--text)'
    }
  }, vals[s.key] == null ? 'Not set' : s.words[vals[s.key] - 1] + ' \u00b7 ' + vals[s.key])), /*#__PURE__*/React.createElement(__ds_scope.ScaleSelector, {
    value: vals[s.key],
    words: s.words,
    low: s.low,
    high: s.high,
    onChange: v => setVals({
      ...vals,
      [s.key]: v
    }),
    style: {
      marginTop: '10px'
    }
  }), s.where && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-label)',
      fontWeight: 600,
      padding: '6px 13px',
      borderRadius: 'var(--r)',
      border: '1px solid var(--border)',
      color: 'var(--accent)',
      display: 'inline-block',
      marginTop: '10px',
      cursor: 'pointer'
    }
  }, "+ Where?"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      padding: '12px 16px 30px',
      borderTop: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    full: true,
    size: "lg",
    onClick: ready ? onSubmit : undefined,
    style: {
      opacity: ready ? 1 : 0.45
    }
  }, ready ? 'Submit entry' : 'Submit entry \u00b7 ' + (5 - answered) + ' to go'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-eyebrow)',
      color: 'var(--faint)',
      textAlign: 'center',
      marginTop: '8px'
    }
  }, "Submitted entries cannot be edited. A correction creates a new revision."))));
}
Object.assign(__ds_scope, { WellnessSheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/athlete_app/WellnessSheet.jsx", error: String((e && e.message) || e) }); }

// ui_kits/staff_web/DashboardScreen.jsx
try { (() => {
const WEEK = [{
  day: 'Mon 3',
  md: 'MD-5',
  summary: 'Recovery + upper body',
  pips: ['train', 'gym'],
  past: true
}, {
  day: 'Tue 4',
  md: 'MD-4',
  summary: 'Skills \u00b7 GPS imported',
  pips: ['train', 'gym'],
  past: true,
  alert: '2 GPS flags',
  tone: 'var(--bad)'
}, {
  day: 'Wed 5',
  md: 'MD-3',
  summary: 'Team run \u00b7 rehab \u00b7 gym',
  pips: ['train', 'rehab', 'gym'],
  today: true,
  alert: '3 need you',
  tone: 'var(--bad)'
}, {
  day: 'Thu 6',
  md: 'MD-2',
  summary: 'Conditioning \u00b7 CMJ testing',
  pips: ['train', 'test']
}, {
  day: 'Fri 7',
  md: 'MD-1',
  summary: "Captain's run",
  pips: ['train'],
  alert: 'Selection due',
  tone: 'var(--accent)'
}, {
  day: 'Sat 8',
  md: 'MD',
  summary: 'v Ashfield RFC \u00b7 home',
  pips: ['match'],
  match: true
}];
const PIP = {
  train: 'var(--accent)',
  gym: 'var(--highlight)',
  rehab: 'var(--warn)',
  test: 'var(--good)',
  match: 'var(--bad)'
};
const SESSIONS = [{
  time: '07:00',
  rel: 'passed',
  name: 'Wellness window',
  group: 'All squads',
  where: 'Push notification \u00b7 closes at 09:00',
  count: '23 / 26',
  label: 'submitted',
  tone: 'var(--warn)',
  past: true,
  needs: [{
    name: 'Nash, Elliot',
    kind: 'Flagged',
    tone: 'bad',
    why: 'Soreness 1 of 5, third morning below his baseline',
    value: '1 / 5'
  }, {
    name: 'Doyle, Sam',
    kind: 'Missing',
    tone: 'warn',
    why: 'Second expected morning with no entry',
    value: '2 days'
  }]
}, {
  time: '09:00',
  rel: 'in 1h 46m',
  name: 'Team run',
  group: 'All squads',
  where: 'Pitch 1 \u00b7 45 min \u00b7 Tom Ellery',
  count: '24 / 26',
  label: 'available',
  tone: 'var(--accent)',
  needs: [{
    name: 'Okafor, Daniel',
    kind: 'Flagged',
    tone: 'bad',
    why: 'HSR 35% above his mean on Tuesday, three days out',
    value: '+35%'
  }, {
    name: 'Reid, Mason',
    kind: 'Modified',
    tone: 'warn',
    why: 'No contact, no sprinting \u00b7 set by medical',
    value: 'day 12'
  }]
}, {
  time: '16:30',
  rel: 'in 9h 16m',
  name: 'Lower body A',
  group: 'Forwards',
  where: 'Main gym \u00b7 55 min \u00b7 S&C',
  count: '15',
  label: 'prescribed',
  tone: 'var(--highlight)',
  needs: []
}];
const PILL = {
  bad: ['var(--pill-bad)', 'var(--on-bad)'],
  warn: ['var(--pill-warn)', 'var(--on-warn)'],
  accent: ['var(--pill-accent)', 'var(--accent)']
};
function DashboardScreen({
  group,
  onNavigate
}) {
  const [day, setDay] = React.useState('Wed 5');
  const cur = WEEK.find(d => d.day === day) || WEEK[2];
  const showTimeline = cur.today;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--gap-card)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.PageHeader, {
    eyebrow: 'WEEK OF MON 3 AUGUST \u00b7 MD SATURDAY 8 \u00b7 ' + group.toUpperCase(),
    title: "Dashboard"
  }), /*#__PURE__*/React.createElement(__ds_scope.StatBar, {
    onSelect: s => s.label === 'To matchday' && onNavigate('schedule'),
    stats: [{
      label: 'Need you',
      value: 3,
      sub: 'athletes today',
      foot: 'across wellness and GPS',
      tone: 'var(--bad)'
    }, {
      label: 'Wellness in',
      value: 88,
      unit: '%',
      sub: '23 of 26 today',
      foot: 'window closes 09:00'
    }, {
      label: 'Available',
      value: '24 / 26',
      sub: '2 modified, 2 out',
      foot: 'status set by medical'
    }, {
      label: 'Open flags',
      value: 5,
      sub: 'unacknowledged',
      foot: 'wellness, gym, GPS',
      tone: 'var(--on-warn-strong)'
    }, {
      label: 'To matchday',
      value: 3,
      unit: ' days',
      sub: 'v Ashfield RFC',
      foot: '2 sessions left to run'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
      gap: '10px'
    }
  }, WEEK.map(d => {
    const on = d.day === day;
    return /*#__PURE__*/React.createElement("div", {
      key: d.day,
      onClick: () => setDay(d.day),
      style: {
        background: 'var(--surf)',
        borderRadius: 'var(--r)',
        padding: '13px 14px',
        cursor: 'pointer',
        border: '1px solid ' + (on ? 'rgba(var(--accent-rgb), 0.55)' : d.today ? 'rgba(var(--accent-rgb), 0.3)' : 'var(--border)'),
        boxShadow: on ? 'var(--ring-select), var(--shadow)' : 'var(--shadow)',
        opacity: d.past && !on ? 0.72 : 1,
        transition: 'border-color var(--dur), box-shadow var(--dur)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '8px',
        alignItems: 'baseline'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '12.5px',
        fontWeight: 700,
        color: d.today ? 'var(--accent)' : 'var(--text)'
      }
    }, d.day), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-num)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 'var(--t-num-caption)',
        fontWeight: 500,
        color: d.match ? 'var(--bad)' : d.md === 'MD-1' ? 'var(--accent)' : 'var(--faint)'
      }
    }, d.md)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--t-num-caption)',
        color: 'var(--muted)',
        marginTop: '4px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, d.summary), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '4px',
        marginTop: '10px'
      }
    }, d.pips.map((p, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        height: 4,
        borderRadius: 'var(--r)',
        flex: 1,
        background: PIP[p]
      }
    }))), d.alert && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--t-micro)',
        fontWeight: 700,
        marginTop: '8px',
        color: d.tone
      }
    }, d.alert));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
      gap: 'var(--gap-card)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '10px',
      margin: '4px 2px 12px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '17px',
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, cur.today ? 'Today' : cur.day + ' August'), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-caption)',
      color: 'var(--muted)'
    }
  }, cur.today ? 'Wed 5 Aug \u00b7 3 sessions \u00b7 first at 09:00' : cur.summary)), showTimeline ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }
  }, SESSIONS.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.time,
    style: {
      display: 'grid',
      gridTemplateColumns: '70px minmax(0, 1fr)',
      gap: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      paddingTop: '18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-body)',
      fontWeight: 500,
      color: s.past ? 'var(--faint)' : 'var(--text)'
    }
  }, s.time), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-micro)',
      color: 'var(--faint)',
      marginTop: '1px'
    }
  }, s.rel)), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "wide",
    style: {
      borderLeft: '3px solid ' + (s.past ? 'var(--line-dashed)' : s.tone),
      borderColor: s.needs.some(n => n.tone === 'bad') ? 'rgba(var(--bad-rgb), 0.3)' : 'var(--border)',
      opacity: s.past ? 0.85 : 1,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto 12px',
      gap: '14px',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '10px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-card)',
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, s.name), /*#__PURE__*/React.createElement(__ds_scope.Pill, {
    tone: "outline",
    size: "md"
  }, s.group)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      color: 'var(--muted)',
      marginTop: '3px'
    }
  }, s.where)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-row)',
      fontWeight: 500
    }
  }, s.count), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-micro)',
      color: 'var(--faint)'
    }
  }, s.label)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontSize: '15px',
      paddingTop: '2px'
    }
  }, "\u203A")), s.needs.length > 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--hair)',
      marginTop: '14px',
      paddingTop: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }
  }, s.needs.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.name,
    style: {
      display: 'grid',
      gridTemplateColumns: '28px minmax(0, 1fr) auto 10px',
      gap: '11px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: n.name,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '13.5px',
      fontWeight: 600
    }
  }, n.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-pill-xs)',
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 'var(--r)',
      background: PILL[n.tone][0],
      color: PILL[n.tone][1]
    }
  }, n.kind)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-num-caption)',
      color: 'var(--muted)',
      marginTop: '1px'
    }
  }, n.why)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-body-2xs)',
      color: PILL[n.tone][1],
      whiteSpace: 'nowrap'
    }
  }, n.value), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontSize: '13px'
    }
  }, "\u203A")))) : /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--hair)',
      marginTop: '14px',
      paddingTop: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '9px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 'var(--r-round)',
      background: 'var(--pill-good)',
      display: 'grid',
      placeItems: 'center',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "9",
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "var(--on-good)",
    strokeWidth: "3",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 10.5l4 4 8-9"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      color: 'var(--muted)'
    }
  }, "Nobody flagged and nothing outstanding for this one.")))))) : /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "wide"
  }, /*#__PURE__*/React.createElement(__ds_scope.EmptyState, {
    title: cur.summary,
    detail: 'Pick Wed 5 to see a full timeline. This kit builds out today only.'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--gap-card)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "wide",
    accent: "accent"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-card-sm)',
      fontWeight: 700
    }
  }, "Ready for Saturday"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      color: 'var(--muted)',
      marginTop: '2px'
    }
  }, "v Ashfield RFC \xB7 home \xB7 3 days out"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-sm)',
      marginTop: '12px',
      textWrap: 'pretty'
    }
  }, "You can name 23 from 26. Reid is the only selection question, and his medical review is booked for Friday morning."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      marginTop: '14px'
    }
  }, [['Fit and available', 'no restriction recorded', 22, 'var(--text)'], ['Doubtful', 'Reid, Mason \u00b7 review Friday 10:00', 1, 'var(--on-warn-strong)'], ['Ruled out', 'Kelly, Sowande \u00b7 plus Grant modified', 3, 'var(--bad)'], ['Sessions left to run', 'Thu conditioning, Fri captain\u2019s run', 2, 'var(--text)']].map(([l, d, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto 10px',
      gap: '11px',
      alignItems: 'center',
      borderTop: '1px solid var(--hair)',
      padding: '11px 0',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-xs)',
      fontWeight: 600
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-eyebrow)',
      color: 'var(--faint)'
    }
  }, d)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-body-xs)',
      color: c
    }
  }, v), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontSize: '13px'
    }
  }, "\u203A"))))), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "wide"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: '10px',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-card-sm)',
      fontWeight: 700
    }
  }, "Outstanding entries"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      fontWeight: 600,
      color: 'var(--accent)',
      cursor: 'pointer'
    }
  }, "Compliance \u203A")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      marginTop: '14px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.MeterBar, {
    label: "Wellness, today",
    value: 88,
    display: "3 left",
    tone: "var(--good)",
    foot: "23 of 26 in \xB7 window closes 09:00"
  }), /*#__PURE__*/React.createElement(__ds_scope.MeterBar, {
    label: "RPE, yesterday",
    value: 65,
    display: "9 left",
    tone: "var(--warn)",
    foot: "17 of 26 in \xB7 due last night"
  }), /*#__PURE__*/React.createElement(__ds_scope.MeterBar, {
    label: "Nutrition, yesterday",
    value: 58,
    display: "11 left",
    tone: "var(--bad)",
    foot: "15 of 26 in \xB7 reminder at 20:00"
  }))))));
}
Object.assign(__ds_scope, { DashboardScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/staff_web/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/staff_web/GateScreen.jsx
try { (() => {
const GATED = {
  training: ['Training report', 'The per-athlete GPS board for one session. It needs GPS records, which arrive through the Premium import.', 'Premium \u00b7 GPS data import \u00b7 heat-mapped session board'],
  'gps-exports': ['GPS exports', 'Importing vendor GPS files and exporting the parsed records is a Premium feature. Basic clubs work from wellness, gym and nutrition entries.', 'Premium \u00b7 Catapult, STATSports, Polar CSV \u00b7 audited exports']
};
function GateScreen({
  feature,
  onUpgrade,
  onNavigate
}) {
  const [title, body, meta] = GATED[feature] || GATED.training;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(__ds_scope.PageHeader, {
    eyebrow: "PREMIUM FEATURE",
    title: title
  }), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "card",
    style: {
      maxWidth: 680,
      marginTop: '20px',
      padding: '24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 'var(--r)',
      background: 'var(--pill-highlight)',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 14 14",
    fill: "none",
    stroke: "var(--on-highlight)",
    strokeWidth: "1.5"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2.4",
    y: "6",
    width: "9.2",
    height: "7",
    rx: "1.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4.6 6V4.2a2.4 2.4 0 014.8 0V6"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-card-sm)',
      fontWeight: 700
    }
  }, "Not on the Basic plan")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--t-body-sm)',
      margin: '14px 0 0'
    }
  }, body), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-caption)',
      color: 'var(--muted)',
      marginTop: '12px'
    }
  }, meta), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      marginTop: '18px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "lg",
    onClick: onUpgrade
  }, "Switch to Premium"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    onClick: () => onNavigate('settings')
  }, "See what each plan includes"))));
}
Object.assign(__ds_scope, { GateScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/staff_web/GateScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/staff_web/SettingsScreen.jsx
try { (() => {
const BASIC = ['Gym programme', 'Nutrition', 'Schedule and fixtures', 'Wellness', 'Reports \u00b7 gym, wellness, testing, nutrition', 'Analytics \u00b7 bar charts', 'Settings and exports'];
const PREMIUM = ['GPS exports', 'Training report', 'Analytics \u00b7 heatmaps', 'Apple Health connection'];
function SettingsScreen({
  plan,
  onPlan,
  onNavigate
}) {
  const premium = plan === 'Premium';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--gap-card)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.PageHeader, {
    eyebrow: "ORGANISATION \xB7 ASHFIELD RFC \xB7 26 ATHLETES",
    title: "Settings"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 780,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--gap-card)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: '16px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-card-sm)',
      fontWeight: 700
    }
  }, "Plan"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      color: 'var(--muted)',
      marginTop: '2px'
    }
  }, premium ? 'Premium \u00b7 GPS, the training report, heatmaps and Apple Health are on.' : 'Basic \u00b7 wellness, gym, nutrition, schedule, reports and bar charts.')), /*#__PURE__*/React.createElement(__ds_scope.Toggle, {
    size: "lg",
    on: premium,
    labels: ['Basic', 'Premium'],
    onChange: v => onPlan(v ? 'Premium' : 'Basic')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      gap: 'var(--gap-card)',
      marginTop: '18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid ' + (premium ? 'var(--border)' : 'rgba(var(--accent-rgb), 0.35)'),
      background: premium ? 'transparent' : 'rgba(var(--accent-rgb), 0.06)',
      borderRadius: 'var(--r)',
      padding: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-sm)',
      fontWeight: 700
    }
  }, "Basic"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      marginTop: '10px'
    }
  }, BASIC.map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    style: {
      fontSize: 'var(--t-body-2xs)'
    }
  }, f)))), /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid ' + (premium ? 'rgba(var(--accent-rgb), 0.35)' : 'var(--border)'),
      background: premium ? 'rgba(var(--accent-rgb), 0.06)' : 'transparent',
      borderRadius: 'var(--r)',
      padding: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body-sm)',
      fontWeight: 700
    }
  }, "Premium"), /*#__PURE__*/React.createElement(__ds_scope.Pill, {
    tone: "highlight",
    size: "sm"
  }, "everything in Basic, plus")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      marginTop: '10px'
    }
  }, PREMIUM.map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    style: {
      fontSize: 'var(--t-body-2xs)'
    }
  }, f)))))), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-card-sm)',
      fontWeight: 700
    }
  }, "Integrations"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      color: 'var(--muted)',
      marginTop: '2px'
    }
  }, "Devices and files that write into Fydr."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      marginTop: '12px'
    }
  }, [['Catapult Openfield', 'GPS session files, CSV import', true, premium ? 'Connected' : 'Locked'], ['Apple Health', 'Sleep, resting heart rate and body mass from the athlete\u2019s phone', true, premium ? 'Connect' : 'Locked'], ['CSV import', 'Squad roster, historic wellness and test results', false, 'Open']].map(([n, d, gated, btn]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: '14px',
      alignItems: 'center',
      padding: '13px 0',
      borderTop: '1px solid var(--hair)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '9px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-body)',
      fontWeight: 600
    }
  }, n), gated && !premium && /*#__PURE__*/React.createElement(__ds_scope.Pill, {
    tone: "highlight",
    size: "sm"
  }, "Premium")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-label)',
      color: 'var(--muted)',
      marginTop: '2px'
    }
  }, d)), btn === 'Connect' ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm"
  }, "Connect") : btn === 'Connected' ? /*#__PURE__*/React.createElement(__ds_scope.Pill, {
    tone: "good",
    size: "lg",
    style: {
      padding: '9px 16px'
    }
  }, "Connected") : /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    size: "sm",
    disabled: btn === 'Locked'
  }, btn))))), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "list"
  }, [['Thresholds', 'The rules that raise a flag', '9 active', 'var(--text)'], ['Passwords', 'Staff sign in and two factor policy', '2FA required', 'var(--text)'], ['Exports', 'Audited, server side, retained 90 days', 'CSV', 'var(--text)'], ['Log out', 'Ends this session on this browser only', '', 'var(--bad)']].map(([l, d, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto 12px',
      gap: '12px',
      alignItems: 'center',
      padding: '15px 0',
      borderTop: '1px solid var(--hair)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '14.5px',
      fontWeight: 600,
      color: c
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-label)',
      color: 'var(--faint)',
      marginTop: '2px'
    }
  }, d)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-caption)',
      color: 'var(--faint)'
    }
  }, v), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontSize: '16px'
    }
  }, "\u203A"))))));
}
Object.assign(__ds_scope, { SettingsScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/staff_web/SettingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/staff_web/Shell.jsx
try { (() => {
const Ico = ({
  children,
  fill
}) => /*#__PURE__*/React.createElement("svg", {
  width: "17",
  height: "17",
  viewBox: "0 0 14 14",
  fill: fill ? 'currentColor' : 'none',
  stroke: fill ? 'none' : 'currentColor',
  strokeWidth: "1.4",
  style: {
    opacity: 0.9
  }
}, children);
const NAV = [{
  key: 'dashboard',
  label: 'Dashboard',
  icon: /*#__PURE__*/React.createElement(Ico, null, /*#__PURE__*/React.createElement("rect", {
    x: "0.9",
    y: "0.9",
    width: "12.2",
    height: "12.2",
    rx: "1.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 0.9v12.2M0.9 7h12.2"
  })),
  children: [{
    key: 'md1',
    label: 'MD-1'
  }, {
    key: 'squad',
    label: 'Squad'
  }, {
    key: 'compliance',
    label: 'Compliance / availability',
    depth: 1
  }, {
    key: 'timetable',
    label: 'Timetable'
  }, {
    key: 'flags',
    label: 'Flags'
  }, {
    key: 'injury',
    label: 'Injury dash',
    depth: 1
  }]
}, {
  key: 'schedule',
  label: 'Schedule',
  icon: /*#__PURE__*/React.createElement(Ico, null, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 3.6V7l2.6 1.6"
  })),
  children: [{
    key: 'fixture',
    label: 'Fixture'
  }, {
    key: 'sessions',
    label: 'Training sessions'
  }]
}, {
  key: 'squadgroup',
  label: 'Squad',
  icon: /*#__PURE__*/React.createElement(Ico, {
    fill: true
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.6",
    y: "0.6",
    width: "2.6",
    height: "2.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "5.7",
    y: "0.6",
    width: "2.6",
    height: "2.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "10.8",
    y: "0.6",
    width: "2.6",
    height: "2.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "0.6",
    y: "5.7",
    width: "2.6",
    height: "2.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "5.7",
    y: "5.7",
    width: "2.6",
    height: "2.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "10.8",
    y: "5.7",
    width: "2.6",
    height: "2.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "0.6",
    y: "10.8",
    width: "2.6",
    height: "2.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "5.7",
    y: "10.8",
    width: "2.6",
    height: "2.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "10.8",
    y: "10.8",
    width: "2.6",
    height: "2.6"
  })),
  children: [{
    key: 'squad-wellness',
    label: 'Wellness'
  }, {
    key: 'squad-gym',
    label: 'Gym'
  }]
}, {
  key: 'reports',
  label: 'Reports',
  icon: /*#__PURE__*/React.createElement(Ico, null, /*#__PURE__*/React.createElement("rect", {
    x: "0.8",
    y: "2.6",
    width: "12.4",
    height: "9.4",
    rx: "2.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4.4 2.6V1.4h5.2v1.2"
  })),
  children: [{
    key: 'training',
    label: 'Training'
  }, {
    key: 'testing',
    label: 'Testing'
  }]
}, {
  key: 'gym',
  label: 'Gym programme',
  icon: /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 14 14",
    fill: "var(--highlight)"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.4 0L2.2 8h3.3L5.1 14L11.8 5.6H8.1z"
  }))
}, {
  key: 'nutrition',
  label: 'Nutrition',
  icon: /*#__PURE__*/React.createElement(Ico, {
    fill: true
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "10",
    height: "10",
    rx: "1.5",
    transform: "rotate(45 7 7)"
  }))
}, {
  key: 'leaderboard',
  label: 'Leaderboard',
  icon: /*#__PURE__*/React.createElement(Ico, {
    fill: true
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "2.4",
    width: "13",
    height: "1.7",
    rx: "0.85"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "6.2",
    width: "13",
    height: "1.7",
    rx: "0.85"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "10",
    width: "13",
    height: "1.7",
    rx: "0.85"
  }))
}, {
  key: 'analytics',
  label: 'Analytics',
  icon: /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 14 14",
    style: {
      opacity: 0.9
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("pattern", {
    id: "kitHatch",
    width: "3",
    height: "3",
    patternUnits: "userSpaceOnUse",
    patternTransform: "rotate(45)"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "1.3",
    height: "3",
    fill: "currentColor"
  }))), /*#__PURE__*/React.createElement("rect", {
    x: "0.8",
    y: "0.8",
    width: "12.4",
    height: "12.4",
    rx: "1.6",
    fill: "url(#kitHatch)",
    stroke: "currentColor",
    strokeWidth: "1.1"
  }))
}, {
  key: 'settings',
  label: 'Settings',
  icon: /*#__PURE__*/React.createElement(Ico, null, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "2.4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.8",
    strokeDasharray: "2.4 2.2"
  }))
}];
const GROUPS = ['All squads', 'Forwards', 'Backs', 'Half backs'];
function Shell({
  active,
  onNavigate,
  group,
  onGroup,
  flags,
  children
}) {
  const [open, setOpen] = React.useState({});
  const items = NAV.map(n => n.key === 'dashboard' ? {
    ...n,
    badge: flags
  } : n);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--page-wash), var(--bg)'
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 'var(--sidebar-w)',
      flex: 'none',
      background: 'var(--surf)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '18px 11px 12px',
      position: 'sticky',
      top: 0,
      height: '100vh'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '2px 6px 22px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-brand)',
      fontSize: '25px',
      fontWeight: 800,
      letterSpacing: '-0.035em'
    }
  }, "Fydr", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent)'
    }
  }, ".")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 26,
      height: 26,
      border: '1px solid var(--border)',
      borderRadius: 'var(--r)',
      display: 'grid',
      placeItems: 'center',
      fontSize: '11px',
      color: 'var(--faint)',
      cursor: 'pointer'
    }
  }, "\xAB")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SidebarNav, {
    items: items,
    active: active,
    open: open,
    onSelect: onNavigate,
    onToggle: (k, v) => setOpen({
      ...open,
      [k]: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border)',
      marginTop: 10,
      paddingTop: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    initials: "SS",
    size: "md",
    role: "staff"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '12.5px',
      fontWeight: 600
    }
  }, "Sports science"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10.5px',
      color: 'var(--faint)',
      cursor: 'pointer'
    }
  }, "Sign out")))), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: 'var(--pad-bar)',
      background: 'var(--bar-bg)',
      backdropFilter: 'var(--bar-blur)',
      WebkitBackdropFilter: 'var(--bar-blur)',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-eyebrow)',
      letterSpacing: 'var(--t-eyebrow-tracking)',
      textTransform: 'uppercase',
      color: 'var(--faint)',
      fontWeight: 600,
      flex: 'none'
    }
  }, "Group"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--gap-chip)',
      flexWrap: 'wrap'
    }
  }, GROUPS.map(g => /*#__PURE__*/React.createElement(__ds_scope.Chip, {
    key: g,
    active: g === group,
    onClick: () => onGroup(g)
  }, g))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-caption)',
      color: 'var(--muted)'
    }
  }, "Wed 5 Aug 2026"), /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    initials: "SS",
    size: "sm",
    role: "staff"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--pad-page)',
      flex: 1
    }
  }, children)));
}
Object.assign(__ds_scope, { NAV, GROUPS, Shell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/staff_web/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/staff_web/TrainingReportScreen.jsx
try { (() => {
const UNITS = ['Front row', 'Second row', 'Back row', 'Half backs', 'Centres', 'Back three'];
const SQUAD = [['Palmer, George', 0, 6260, 2845, 589, 135, 30.3, 94], ['Reid, Mason', 0, 5090, 2474, 642, 144, 30.8, 89], ['Bennett, Noah', 0, 4860, 2298, 539, 102, 28.3, 84], ['Chapman, Max', 1, 7120, 3564, 761, 92, 28.5, 80], ['Carter, Liam', 1, 4080, 2100, 525, 148, 31.7, 80], ['Fox, Lucas', 2, 6850, 3133, 796, 119, 31.2, 84], ['Thompson, Jack', 2, 6630, 3515, 776, 53, 30.6, 72], ['Ellis, Harry', 3, 7940, 4120, 1102, 141, 33.1, 91], ['Doyle, Sam', 3, 5620, 2910, 704, 96, 31.0, 83], ['Hayes, Owen', 4, 7480, 3940, 1015, 134, 33.6, 93], ['Okafor, Daniel', 5, 8120, 4344, 1286, 152, 34.2, 95], ['Sinclair, Rhys', 5, 7760, 4015, 1193, 139, 33.8, 92]];
const SESSIONS = [{
  id: 'a',
  label: 'Fri 31 Jul',
  md: 'MD-1',
  k: 1.00,
  mins: 44
}, {
  id: 'b',
  label: 'Fri 24 Jul',
  md: 'MD-1',
  k: 0.97,
  mins: 42
}, {
  id: 'c',
  label: 'Fri 17 Jul',
  md: 'MD-1',
  k: 1.01,
  mins: 46
}];
const KF = {
  td: 0.562,
  hsr: 0.376,
  hie: 0.564,
  maxv: 0.94
};
const fmt = n => Math.round(n).toLocaleString('en-GB');
const ALPHA = ['var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)', 'var(--heat-5)'];
const GREEN = ['var(--heat-pct-1)', 'var(--heat-pct-2)', 'var(--heat-pct-3)', 'var(--heat-pct-4)', 'var(--heat-pct-5)'];
function p95(vals) {
  const s = vals.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.round(0.95 * (s.length - 1)))];
}
const band = (v, ref) => {
  const n = Math.min(1, Math.max(0, v / ref));
  return n < 0.2 ? 0 : n < 0.4 ? 1 : n < 0.6 ? 2 : n < 0.8 ? 3 : 4;
};
const pctBand = v => v < 70 ? 0 : v < 80 ? 1 : v < 85 ? 2 : v < 90 ? 3 : 4;
const cols = 'minmax(180px, 1.4fr) repeat(5, minmax(66px, 1fr))';
function TrainingReportScreen({
  group
}) {
  const [sel, setSel] = React.useState('a');
  const cur = SESSIONS.find(s => s.id === sel) || SESSIONS[0];
  const pool = group === 'Forwards' ? SQUAD.filter(a => a[1] <= 2) : group === 'Backs' ? SQUAD.filter(a => a[1] >= 3) : group === 'Half backs' ? SQUAD.filter(a => a[1] === 3) : SQUAD;
  const rows = pool.map(a => ({
    name: a[0],
    unit: a[1],
    td: a[2] * KF.td * cur.k,
    hsr: a[4] * KF.hsr * cur.k,
    hie: a[5] * KF.hie * cur.k,
    maxv: a[6] * KF.maxv,
    pct: a[7]
  }));
  const enough = rows.length >= 5;
  const refHsr = enough ? p95(rows.map(r => r.hsr)) : 0;
  const refHie = enough ? p95(rows.map(r => r.hie)) : 0;
  const meanTd = rows.reduce((t, r) => t + r.td, 0) / rows.length;
  const meanHsr = rows.reduce((t, r) => t + r.hsr, 0) / rows.length;
  const hiePerMin = rows.reduce((t, r) => t + r.hie, 0) / rows.length / cur.mins;
  const refs = {
    td: 3395,
    hsr: 267,
    hie: 1.31
  };
  const sEnd = Math.round(meanTd / refs.td * 100);
  const sHsr = Math.round(meanHsr / refs.hsr * 100);
  const sInt = Math.round(hiePerMin / refs.hie * 100);
  const tone = p => p >= 122 ? 'var(--bad)' : p >= 110 ? 'var(--warn)' : p >= 92 ? 'var(--accent)' : 'var(--accent2)';
  const status = p => p >= 122 ? 'Much harder than usual' : p >= 110 ? 'Harder than usual' : p >= 92 ? 'A typical session' : p >= 82 ? 'Lighter than usual' : 'Much lighter than usual';
  const dials = [{
    label: 'Intensity',
    value: sInt,
    raw: hiePerMin.toFixed(2) + ' HIE/min'
  }, {
    label: 'High speed',
    value: sHsr,
    raw: fmt(meanHsr) + ' m each'
  }, {
    label: 'Endurance',
    value: sEnd,
    raw: fmt(meanTd) + ' m each'
  }];
  const outside = dials.filter(d => d.value >= 112 || d.value <= 88);
  const sorted = dials.slice().sort((a, b) => Math.abs(b.value - 100) - Math.abs(a.value - 100));
  const word = sorted[0].value > 100 ? 'harder' : 'lighter';
  const headline = !outside.length ? 'A typical MD-1.' : outside.length === 1 && Math.abs(sorted[0].value - 100) - Math.abs(sorted[1].value - 100) >= 6 ? 'A ' + word + ' MD-1 than usual, and ' + sorted[0].label.toLowerCase() + ' is what made it ' + word + '.' : 'A ' + word + ' MD-1 than usual on ' + outside.length + ' of the three axes.';
  const board = [];
  UNITS.forEach((u, ui) => {
    const inUnit = rows.filter(r => r.unit === ui).sort((a, b) => b.td - a.td);
    if (!inUnit.length) return;
    board.push(/*#__PURE__*/React.createElement(__ds_scope.TableGroup, {
      key: u,
      label: ui + 1 + '. ' + u.toUpperCase(),
      columns: cols,
      meta: 'unit mean ' + fmt(inUnit.reduce((t, r) => t + r.td, 0) / inUnit.length) + ' m'
    }));
    inUnit.forEach(r => {
      const flagged = r.name === 'Okafor, Daniel' || r.name === 'Carter, Liam';
      board.push(/*#__PURE__*/React.createElement(__ds_scope.TableRow, {
        key: r.name,
        columns: cols,
        wash: flagged ? 'var(--wash-bad)' : 'transparent',
        cells: [r.name, fmt(r.td), {
          text: fmt(r.hsr),
          bg: enough ? ALPHA[band(r.hsr, refHsr)] : undefined
        }, {
          text: fmt(r.hie),
          bg: enough ? ALPHA[band(r.hie, refHie)] : undefined
        }, r.maxv.toFixed(1), enough ? {
          text: r.pct + '%',
          bg: GREEN[pctBand(r.pct)],
          fg: 'var(--heat-pct-text)'
        } : r.pct + '%']
      }));
    });
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--gap-card)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.PageHeader, {
    eyebrow: 'SQUAD \u00b7 ' + cur.md + ' \u00b7 ' + cur.label.toUpperCase() + ' \u00b7 ' + group.toUpperCase() + ' \u00b7 ' + cur.mins + ' MIN',
    title: "Training report"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    }
  }, SESSIONS.map(s => /*#__PURE__*/React.createElement(__ds_scope.Chip, {
    key: s.id,
    variant: "record",
    active: s.id === sel,
    onClick: () => setSel(s.id)
  }, s.label))), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "lead"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: '28px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '12px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--t-card-lg)',
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, "Captain\u2019s run"), /*#__PURE__*/React.createElement(__ds_scope.Pill, {
    tone: "accent",
    size: "md"
  }, cur.md)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '22px',
      flexWrap: 'wrap',
      marginTop: '12px'
    }
  }, [['Date', cur.label], ['Duration', cur.mins + ' min'], ['Where', 'Pitch 1'], ['Athletes', rows.length]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-micro)',
      letterSpacing: 'var(--t-colhead-tracking)',
      textTransform: 'uppercase',
      color: 'var(--faint)',
      fontWeight: 600
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-body)',
      fontWeight: 500
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--hair)',
      marginTop: '16px',
      paddingTop: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-card-sm)',
      fontWeight: 700
    }
  }, headline), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-xs)',
      color: 'var(--muted)',
      marginTop: '4px',
      maxWidth: '76ch'
    }
  }, "Endurance ", sEnd, "%, high speed running ", sHsr, "% and intensity ", sInt, "% of a typical MD-1. Scores above 100 mean the squad did more than they normally do the day before a match."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-eyebrow)',
      color: 'var(--faint)',
      marginTop: '8px'
    }
  }, "Typical = the mean of the 2 other MD-1 sessions \xB7 ", fmt(refs.td), " m, ", refs.hsr, " m HSR, ", refs.hie, " HIE/min"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '18px',
      paddingLeft: '26px',
      borderLeft: '1px solid var(--hair)'
    }
  }, dials.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.label,
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Dial, {
    value: d.value,
    display: d.value,
    unit: "of typical",
    max: 130,
    tick: true,
    tone: tone(d.value),
    size: 104
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-body-2xs)',
      fontWeight: 700,
      marginTop: '8px'
    }
  }, d.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--t-eyebrow)',
      fontWeight: 700,
      color: tone(d.value)
    }
  }, status(d.value)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-num)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 'var(--t-num-micro)',
      color: 'var(--faint)'
    }
  }, d.raw)))))), !enough && /*#__PURE__*/React.createElement(__ds_scope.Banner, {
    tone: "warn",
    title: "Shading is off:"
  }, "fewer than 5 athletes with data in ", group, ". The numbers are unchanged."), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pad: "card"
  }, /*#__PURE__*/React.createElement(__ds_scope.TableShell, {
    columns: cols,
    minWidth: "880px",
    head: ['Player', 'TD', 'HSR', 'HIE', 'MaxV', '%Max'],
    caption: enough ? 'Shading vs squad p95, last 28 days \u00b7 n = ' + rows.length + ' athletes \u00b7 HSR blue, HIE blue, %MAX green' : 'Shading suppressed \u00b7 ' + rows.length + ' athletes with data, floor is 5'
  }, board)));
}
Object.assign(__ds_scope, { TrainingReportScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/staff_web/TrainingReportScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.ScaleSelector = __ds_scope.ScaleSelector;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Pill = __ds_scope.Pill;

__ds_ns.Dial = __ds_scope.Dial;

__ds_ns.DomainDot = __ds_scope.DomainDot;

__ds_ns.MeterBar = __ds_scope.MeterBar;

__ds_ns.RangeBar = __ds_scope.RangeBar;

__ds_ns.Sparkline = __ds_scope.Sparkline;

__ds_ns.StatBar = __ds_scope.StatBar;

__ds_ns.TableShell = __ds_scope.TableShell;

__ds_ns.TableGroup = __ds_scope.TableGroup;

__ds_ns.TableRow = __ds_scope.TableRow;

__ds_ns.SidebarNav = __ds_scope.SidebarNav;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.Banner = __ds_scope.Banner;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.FlagCard = __ds_scope.FlagCard;

__ds_ns.PageHeader = __ds_scope.PageHeader;

__ds_ns.ReadCard = __ds_scope.ReadCard;

__ds_ns.MyDataScreen = __ds_scope.MyDataScreen;

__ds_ns.Phone = __ds_scope.Phone;

__ds_ns.TodayScreen = __ds_scope.TodayScreen;

__ds_ns.WellnessSheet = __ds_scope.WellnessSheet;

__ds_ns.DashboardScreen = __ds_scope.DashboardScreen;

__ds_ns.GateScreen = __ds_scope.GateScreen;

__ds_ns.SettingsScreen = __ds_scope.SettingsScreen;

__ds_ns.NAV = __ds_scope.NAV;

__ds_ns.GROUPS = __ds_scope.GROUPS;

__ds_ns.Shell = __ds_scope.Shell;

__ds_ns.TrainingReportScreen = __ds_scope.TrainingReportScreen;

})();
