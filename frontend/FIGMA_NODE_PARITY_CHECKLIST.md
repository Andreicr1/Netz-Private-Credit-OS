# Figma Node Parity Checklist

Status legend:
- OK: implemented and mapped in active UI
- PARTIAL: implemented but may still need visual fine tuning against exact state variants
- N/A: node provided but component pattern is not used in current UI flows

## Shell and Navigation
- OK — ShellBar: 284243:925, 732:5439, 285220:10833, 285220:3269, 285220:5418
- OK — Navigation Layout: 612:4681
- OK — Side Navigation: 283196:387
- PARTIAL — Dynamic Page spacing reference (S/4HANA kit): 473:442
- OK — Bar (header action bar): 1101:2321

## Buttons
- OK — Button (primary/secondary/tertiary/attention): 91702:11733
- OK — Icon Button: 91702:11885
- OK — Menu Button: 91702:10981
- N/A — Split Button: 188672:2082
- N/A — Segmented Button: 91702:11986
- N/A — Button Badge: 101875:11855

## Form Controls
- OK — Input: 148569:1004
- OK — TextArea: 148569:1916
- OK — Date Picker: 160531:1416
- OK — Select/Option: 193727:1650, 181512:6908, 181557:7410, 182813:5890, 181557:7507, 181776:4556, 181190:770

## Data Display and Feedback
- OK — Table (header/rows/selection/empty): 200144:6019, 4030:7473, 191125:43355
- OK — Dialog: 1101:2510
- OK — Message Strip: 1101:2510
- OK — Busy/Loading: 23575:10458
- OK — Panel: 24070:10588

## Notes
- Split/Segmented/Badge button patterns are intentionally marked N/A because they are not part of the current governed UX scope.
- Final parity pass completed for icon-button and table nodes; remaining pixel-level differences, if any, are limited to non-governed interaction microstates (hover/down permutations).
