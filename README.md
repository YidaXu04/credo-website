# CREDO Academic Project Website

Static, demo-first academic website prototype for:

**Conformalized Decision Risk Assessment**  
**CREDO: Conformalized Risk Estimation for Decision Optimization**  
Wenbin Zhou, Agni Orfanoudaki, Shixiang Zhu

## Files

- `index.html` contains the project page content and section structure.
- `style.css` contains all styling and responsive layout rules.
- `script.js` contains the dependency-free interactive 2D linear, quadratic, and binary knapsack demo logic and tab state management.
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

The current interactive demo is intentionally limited to simplified fixed-context/marginal 2D linear and convex quadratic program visualizations plus a small binary knapsack case. The knapsack example uses a linear objective, one linear capacity constraint, and binary decision variables. Its small feasible set is solved exactly by enumeration, with item values parameterized as affine functions of a 2D uncertain outcome so the inverse near-optimal region can still be visualized in the outcome canvas.

The quadratic demo defaults to the paper's stylized QP matrix `Q = 0.1I`, with an optional control for exploring other symmetric positive-definite 2x2 matrices. Tabs preserve independent demo states for comparison, including the selected problem class and selected binary subset. The knapsack example is not a general MILP implementation: arbitrary integer constraints, mixed continuous/integer variables, branch-and-bound, 3D views, real-world data, and model training remain future work and are not implemented in this static prototype. The browser visualization is educational and does not reproduce Algorithm 2 or the paper's theoretical guarantees.
