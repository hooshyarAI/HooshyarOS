# Final Product Qualification Execution

The aggregate runner executes the critical internal qualification gates in one machine-readable run.

## Internal gates

- Runtime / business flow
- Architecture / boot graph
- Persistence / recovery / tenant isolation
- Security
- Dashboard / financial customer value
- AI / reasoning
- Installer / deployment contracts

## External gates

The following remain blocked until real target-environment evidence is produced:

- Windows real-device installation and real business workflow
- Web real-browser/PWA acceptance
- Android real-device installation and real business workflow
- Production cloud activation
- Payment-provider activation

These are never promoted to PASS by repository tests.

## Overall verdicts

- `BLOCK_INTERNAL`: at least one internal qualification gate failed or required test is missing.
- `BLOCK_EXTERNAL`: all internal qualification gates passed, but one or more external gates remain unexecuted.
- `FINAL_PRODUCT_RELEASE`: allowed only after all critical external gates also pass and no external production dependency remains unresolved.
