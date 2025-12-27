### Task 1 - Integrate New Radar Power Path Integration Methods
- We are refining the simulation approach for a more accurate power based method. We take the original ISAMSystem definition with the addition of an antenna gain and use this to derive the radar power and characteristics.

- Precipitation field sampling methods should now use this method instead and integrating the subsequent path losses for the radar beam and using the min_snr requirement to determine detectability.

- ### Task 2 - Allow for update of number of pulse integrations and RCS to recalculate the detectability plots for the radar. Many duplicate unclear methods in the current application, refactor and simplify API.
- 
- ### Task 3 - Move SAM engagement simulation to only initialize and save initial states to the backend but step the simulation through our frontend JS. Remove all state from controllers and integrate with Vercel serveless.

- ### Task 4 - Move all file storage to postgres instance

- ### Task 5 - Implement application key authentication for security purposes. We only require a single point of entry for full access.

- ### Task 6 - Precipitation fields are calculated from a point impulse diffusion convolution based on a weighted gaussian kernel. This initializes our precipitation field on a pixel grid which is stored as a png. Add an "advection, diffusion, vorticity step" to simulate state evolution, no requirement for simuation accuracy regarding atmosphere.

- ### Task 7 - Implement fighter evasive manuever, implement by having a detected fighter choose the nearest point that evades radar detection and turning towards this

- ### Task 8 - Develop unsupervised learning environment, map simulation states to control outputs, dynamics model remains simple maxG model and thrust/max vel model. Allow ANN to initialize fighter positions, allow for partial convolutional layer associated with image field. Train unsupervised with reward/penalty functions
