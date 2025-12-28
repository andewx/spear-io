/**
 * Main router configuration
 * Wires up all controllers to their respective endpoints
 */
import { Router } from 'express';
import { PlatformController } from '../controllers/PlatformController.js';
import { ScenarioController } from '../controllers/ScenarioController.js';
import { SimulationController } from '../controllers/SimulationController.js';
import { SyntheticController } from '../controllers/SyntheticController.js';
import { FormController } from '../controllers/FormController.js';
import { MainController } from '../controllers/MainController.js';
// Initialize controllers
const platformController = new PlatformController();
const scenarioController = new ScenarioController();
const simulationController = new SimulationController();
const syntheticController = new SyntheticController();
const formController = new FormController();
const mainController = new MainController();
// Create main router
const router = Router();
router.get('/main/:cmd', async (req, res) => mainController.command(req, res));
// ============================================================================
// Synthetic/Precipitation Routes
// ============================================================================
router.post('/synthetic/precipitation', async (req, res) => {
    await syntheticController.generatePrecipitationField(req, res);
});
router.get('/synthetic/precipitation/:filename', async (req, res) => {
    await syntheticController.servePrecipitationImage(req, res);
});
// ============================================================================
// Platform Routes
// ============================================================================
router.get('/platforms', (req, res) => platformController.listAll(req, res));
router.get('/platforms/:type/:id', (req, res) => platformController.getById(req, res));
router.post('/platforms', (req, res) => platformController.create(req, res));
router.put('/platforms/:type/:id', (req, res) => platformController.update(req, res));
router.delete('/platforms/:type/:id', (req, res) => platformController.delete(req, res));
// ============================================================================
// Scenario Routes
// ============================================================================
router.get('/scenarios', (req, res) => scenarioController.listAll(req, res));
router.get('/scenarios/:id', (req, res) => scenarioController.getById(req, res));
router.post('/scenarios', (req, res) => scenarioController.create(req, res));
router.put('/scenarios/:id', (req, res) => scenarioController.update(req, res));
router.delete('/scenarios/:id', (req, res) => scenarioController.delete(req, res));
// ============================================================================
// Simulation Routes
// ============================================================================
router.post('/simulation/run', async (req, res) => {
    await simulationController.run(req, res);
});
router.post('/simulation/step', async (req, res) => {
    await simulationController.step(req, res);
});
router.post('/simulation/reset', async (req, res) => {
    await simulationController.reset(req, res);
});
router.post('/simulation/init', (req, res) => {
    simulationController.initialize(req, res);
});
router.get('/simulation/state', (req, res) => {
    simulationController.getState(req, res);
});
router.post('/simulation/getRanges', (req, res) => {
    simulationController.getRangesProfile(req, res);
});
// ============================================================================
// Form Routes (for overlay content)
// ============================================================================
router.get('/forms/platform/create', (req, res) => formController.platformCreate(req, res));
router.get('/forms/platform/edit/:type/:id', (req, res) => formController.platformEdit(req, res));
router.get('/forms/scenario/create', (req, res) => formController.scenarioCreate(req, res));
router.get('/forms/scenario/edit/:id', (req, res) => formController.scenarioEdit(req, res));
export default router;
//# sourceMappingURL=router.js.map