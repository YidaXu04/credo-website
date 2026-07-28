# CREDO Academic Project Website

Static, demo-first academic website prototype for:

**Conformalized Decision Risk Assessment**  
**CREDO: Conformalized Risk Estimation for Decision Optimization**  
Wenbin Zhou, Agni Orfanoudaki, Shixiang Zhu

## Files

- `index.html` contains the project page content and section structure.
- `style.css` contains all styling and responsive layout rules.
- `script.js` contains the dependency-free interactive Linear, Quadratic, Knapsack (2D–2D), and Knapsack (4D–2D) demo logic. Linear switches between a 2D LP and a true 3D LP; Quadratic has a standard 2D demo plus an educational 2D-derived 3D visualization.
- `Conformalized Decision Risk Assessment.pdf` is linked from the Paper button when present in the project root.

## Local Preview

Open `index.html` directly in a browser. No build step or framework is required. MathJax is loaded from a CDN for mathematical notation.

## GitHub Pages Deployment

This repository is ready to deploy as a static site from the repository root using GitHub Pages. Set the Pages source to the main branch and root directory. The site uses relative paths for the stylesheet and linked PDF.

## Still Needs Author Confirmation

- Code repository link.
- Official paper link.
- Final BibTeX.
- Wording approval.

## Demo Scope

The current interactive demo is intentionally limited to simplified fixed-context/marginal Linear and convex Quadratic program visualizations plus two small finite knapsack cases. The demo displays a compact, complete optimization formulation for every supported problem class, including the objective, decision variable domain, and constraints.

### 3D Views

The problem selector has one `Linear program` option. The Dimension / view selector switches it between the original 2D LP and a genuine 3D LP with `z in R^3`, `y in R^3`, a fixed tetrahedral decision polytope `Z = conv{v1,v2,v3,v4}`, generated 3D outcome samples, and a voxel-slice approximation of the true inverse epsilon-near-optimal region. In both dimensions, the selected feasible decision `z` is draggable; in 3D, `z` can move through the tetrahedron interior and clicking a tetrahedron vertex selects that vertex exactly. Linear 3D risk is restricted to Monte Carlo mode because p-value and e-value radii are only implemented for the 2D inverse-region geometry in this prototype.

The quadratic-program 3D view remains an educational 2D-derived visualization prototype, not a true 3D QP. It does not add real data, model training, a 3D optimizer, Algorithm 2, or theoretical guarantees. Its cross-sections are numerical approximations using the same finite candidate approximation already used by the 2D QP demo for `0.5 * z^T Q z + y^T z`.

Interaction in 3D mode is dependency-free canvas interaction: drag Linear 3D's decision point within the tetrahedron, drag the outcome canvas to rotate the view, or focus the outcome canvas and use the arrow keys. `ArrowLeft`/`ArrowRight` rotate horizontally, `ArrowUp`/`ArrowDown` adjust pitch, and `Home` resets the 3D camera. Keyboard focus is enabled only while an active 3D visualization is shown. Tabs preserve their own selected dimension/view, 3D camera angle, problem class, Linear 2D decision, Linear 3D decision, Q configuration, and generated outcome settings.

Both Knapsack demos remain 2D-only. Their 3D option is disabled with an explanatory note, and no general mixed-integer optimizer or 3D knapsack visualization is included.

Knapsack (2D–2D) uses the 2D binary decision variable `z = (z1, z2)`, a linear objective `y^T z`, and one linear capacity constraint. Both the decision space and outcome space are visualized in 2D, and the feasible 2D binary points are solved exactly by enumeration.

Knapsack (4D–2D) uses `z in {0,1}^4`, item weights `[2, 3, 4, 5]`, capacity `C = 6`, and default selected decision `z = (1,1,0,0)`. Its outcome remains `y in R^2`; each item value is a deterministic affine function of the 2D outcome, so all feasible 4D binary decisions can be compared exactly while the inverse near-optimal region remains visible in the 2D outcome canvas. Feasible 4D subsets are enumerated by finite bitmask enumeration.

The quadratic demo defaults to the paper's stylized QP matrix `Q = 0.1I`, with an optional control for exploring other symmetric positive-definite 2x2 matrices. Tabs preserve independent demo states for comparison, including the selected problem class and selected knapsack decision for each knapsack variant. Both knapsack examples are educational finite examples, not general MILP solvers: arbitrary integer constraints, mixed continuous/integer variables, branch-and-bound, 3D knapsack views, real-world data, and model training remain future work and are not implemented in this static prototype. The browser visualization does not reproduce Algorithm 2 or the paper's theoretical guarantees.
