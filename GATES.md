# Gates: Connect fixture UI coverage audit

OWNS: GATES.md, manujujaya-mcp.pen

Scope: Reconcile every connect fixture outcome with the authorization canvas and add any missing reusable UI states.

- [x] G1: Every file in fixtures/connect is classified by observable route, response, or UI outcome
  EVIDENCE: Direct inspection classified all 10 source fixtures; generated graph artifacts were excluded and removed after the data-only graph produced zero nodes.

- [x] G2: Existing .pen states and reusable components are inventoried without assuming coverage from their names
  EVIDENCE: Bootstrap canvas inventory contained eight authorization states and one reusable authorization card; implementation tracing established that these did not cover the separate Connect flow.

- [x] G3: A fixture-to-canvas matrix identifies covered, partial, and missing outcomes
  EVIDENCE: Canvas frame N5sZnz contains ten fixture rows with observed outcome, product handling, and canvas coverage columns.

- [x] G4: Every missing user-visible state is added to the canvas using reusable components and consistent styling
  EVIDENCE: Delegated Login/OTP and Merchant/Outlet containers contain 6 and 3 completed children; main session added token checking, found, missing, paste fallback, and OTP-unsupported states using reusable components yF8Fp and SDYij.

- [x] G5: Final state frames have no clipping, collapsed layout, gradients, or active shadows
  EVIDENCE: Resolved-instance scans for WhyWv, stZj3, and N5sZnz emitted no problem, gradient, or active-effect rows; delegated sections completed through the canvas designer workflow.
