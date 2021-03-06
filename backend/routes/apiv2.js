const express = require('express');
const jwt = require('jsonwebtoken');
const logger = require('winston');
const config = require('../../config');
const realmModel = require('../models/realm');
const realmManager = require('../managers/realmmanager');
const rentManager = require('../managers/rentmanager');
const occupantManager = require('../managers/occupantmanager');
const documentManager = require('../managers/documentmanager');
const propertyManager = require('../managers/propertymanager');
const ownerManager = require('../managers/ownermanager');
const notificationManager = require('../managers/notificationmanager');
const accountingManager = require('../managers/accountingmanager');
const emailManager = require('../managers/emailmanager');

module.exports = function() {
    const router = express.Router();

    // protect the api access by checking the access token
    router.use((req, res, next) => {
        if (!req.headers.authorization) {
            return res.sendStatus(403);
        }

        const accessToken = req.headers.authorization.split(' ')[1];
        if (!accessToken) {
            return res.sendStatus(403);
        }

        try {
            const decoded = jwt.verify(accessToken, config.ACCESS_TOKEN_SECRET);
            req.user = decoded.account;
        } catch (err) {
            logger.warn(err);
            return res.sendStatus(403);
        }

        next();
    });

    // update req with the user organizations
    router.use((req, res, next) => {
        if (req.path !== '/realms' && !req.headers.organizationid) {
            return res.sendStatus(404);
        }

        realmModel.findByEmail(req.user.email, (err, realms = []) => {
            if (err) {
                return next(err);
            }
            if (realms.length) {
                req.realms = realms;
                const realmId = req.headers.organizationid;
                if (realmId) {
                    req.realm = req.realms.find(realm =>
                        realm._id.toString() === realmId
                    );
                    if (req.path !== '/realms' && !req.realm) {
                        return res.sendStatus(404);
                    }
                }
            } else {
                delete req.realm;
                delete req.realms;
            }
            next();
        });
    });

    const realmsRouter = express.Router();
    realmsRouter.get('/', realmManager.all);
    realmsRouter.get('/:id', realmManager.one);
    realmsRouter.post('/', realmManager.add);
    realmsRouter.patch('/:id', realmManager.update);
    router.use('/realms', realmsRouter);

    const occupantsRouter = express.Router();
    occupantsRouter.post('/', occupantManager.add);
    occupantsRouter.patch('/:id', occupantManager.update);
    occupantsRouter.delete('/:ids', occupantManager.remove);
    occupantsRouter.get('/', occupantManager.all);
    occupantsRouter.get('/:id', occupantManager.one);
    occupantsRouter.get('/overview', occupantManager.overview);
    router.use('/tenants', occupantsRouter);

    const documentsRouter = express.Router();
    documentsRouter.get('/:document/:id/:term', documentManager.get);
    documentsRouter.patch('/:id', documentManager.update);
    router.use('/documents', documentsRouter);

    const notificationsRouter = express.Router();
    notificationsRouter.get('/', notificationManager.all);
    router.use('/notifications', notificationsRouter);

    const rentsRouter = express.Router();
    rentsRouter.patch('/payment/:id', rentManager.update);
    rentsRouter.get('/tenant/:id', rentManager.rentsOfOccupant);
    rentsRouter.get('/tenant/:id/:year/:month', rentManager.rentOfOccupant);
    rentsRouter.get('/:year/:month', rentManager.all);
    router.use('/rents', rentsRouter);

    const propertiesRouter = express.Router();
    propertiesRouter.post('/', propertyManager.add);
    propertiesRouter.patch('/:id', propertyManager.update);
    propertiesRouter.delete('/:ids', propertyManager.remove);
    propertiesRouter.get('/', propertyManager.all);
    propertiesRouter.get('/overview', propertyManager.overview);
    router.use('/properties', propertiesRouter);

    router.get('/accounting/:year', accountingManager.all);

    const ownerRouter = express.Router();
    ownerRouter.get('/', ownerManager.all);
    ownerRouter.patch('/:id', ownerManager.update);
    router.use('/owner', ownerRouter);

    const emailRouter = express.Router();
    emailRouter.post('/', emailManager.send);
    router.use('/emails', emailRouter);

    const apiRouter = express.Router();
    apiRouter.use('/api/v2', router);
    return apiRouter;
};
