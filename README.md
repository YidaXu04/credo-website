# CREDO Academic Project Website

Static, demo-first academic website prototype for:

**Conformalized Decision Risk Assessment**  
**CREDO: Conformalized Risk Estimation for Decision Optimization**  
Wenbin Zhou, Agni Orfanoudaki, Shixiang Zhu

## Files

- `index.html` contains the project page content and section structure.
- `style.css` contains all styling and responsive layout rules.
- `script.js` contains the dependency-free interactive 2D linear, quadratic, Knapsack (2D–2D), and Knapsack (4D–2D) demo logic and tab state management.
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

The current interactive demo is intentionally limited to simplified fixed-context/marginal 2D linear and convex quadratic program visualizations plus two small finite knapsack cases.

Knapsack (2D–2D) uses the 2D binary decision variable `z = (z1, z2)`, a linear objective `y^T z`, and one linear capacity constraint. Both the decision space and outcome space are visualized in 2D, and the feasible 2D binary points are solved exactly by enumeration.

Knapsack (4D–2D) uses `z in {0,1}^4`, item weights `[2, 3, 4, 5]`, capacity `C = 6`, and default selected decision `z = (1,1,0,0)`. Its outcome remains `y in R^2`; each item value is a deterministic affine function of the 2D outcome, so all feasible 4D binary decisions can be compared exactly while the inverse near-optimal region remains visible in the 2D outcome canvas. Feasible 4D subsets are enumerated by finite bitmask enumeration.

The quadratic demo defaults to the paper's stylized QP matrix `Q = 0.1I`, with an optional control for exploring other symmetric positive-definite 2x2 matrices. Tabs preserve independent demo states for comparison, including the selected problem class and selected knapsack decision for each knapsack variant. Both knapsack examples are educational finite examples, not general MILP solvers: arbitrary integer constraints, mixed continuous/integer variables, branch-and-bound, 3D views, real-world data, and model training remain future work and are not implemented in this static prototype. The browser visualization does not reproduce Algorithm 2 or the paper's theoretical guarantees.
