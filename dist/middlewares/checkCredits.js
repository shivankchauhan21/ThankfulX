"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCredits = void 0;
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const errors_1 = require("../utils/errors");
const checkCredits = async (req, res, next) => {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const cost = (_b = req.body._calculatedCost) !== null && _b !== void 0 ? _b : 1;
    if (!userId) {
        throw new errors_1.AuthenticationError('User not authenticated');
    }
    try {
        // Use transaction to prevent race conditions
        const user = await prismaClient_1.default.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { id: true, credits: true }
            });
            if (!user) {
                throw new errors_1.AuthenticationError('User not found');
            }
            if (user.credits < cost) {
                throw new errors_1.InsufficientCreditsError(cost, user.credits);
            }
            return user;
        });
        // Attach user to request for later use
        if (req.user) {
            req.user = { ...req.user, credits: user.credits };
        }
        next();
    }
    catch (error) {
        if (error instanceof errors_1.AppError) {
            throw error;
        }
        throw new errors_1.DatabaseError('Failed to check user credits');
    }
};
exports.checkCredits = checkCredits;
