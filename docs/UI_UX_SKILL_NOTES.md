# UI/UX principles applied

This product's visual system and interaction choices were reviewed against the published **User Interface Wiki** skill by Raphael Salaja: https://github.com/raphaelsalaja/userinterface-wiki and https://www.userinterface.wiki/skill.

The requested command `npx skills add raphaelsalaja/userinterface-wiki --yes` was attempted in the build environment, but package/repository network access was unavailable. The skill could therefore not be installed as a local agent skill. These implementation notes use the project's published guidance and should not be mistaken for a successful install.

Applied principles:

- Visual hierarchy is driven by typography, spacing, a restrained palette, and consistent surface/border treatments rather than heavy cards or decorative gradients.
- Use short, purposeful interaction transitions (roughly 120–180 ms); the loading shimmer is limited to loading state, and motion is reduced for `prefers-reduced-motion`.
- Controls are native where practical, have clear labels, and include visible keyboard focus states. Navigation and icon-only actions have accessible labels.
- Reusable metrics, headers, chart legends, source banners, and status pills share consistent visual tokens.
- Numeric values use tabular-friendly typography and consistent English/UK formatting; timestamps are explicitly displayed in `Europe/London`.
- Missing observations are exposed as statuses and coverage values rather than interpolated or hidden.
- Animation is used for feedback and not to distract from dense analytical content.

The upstream skill is a living collection (published skill summary describes 152 rules across animation, accessibility, performance, typography, interaction design and related topics). Please review the original source before adopting its newest rules in a future iteration.
