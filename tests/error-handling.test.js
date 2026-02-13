/**
 * @jest-environment node
 */
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.EMAIL_VERIFICATION_REQUIRED = 'false';
process.env.TWO_FACTOR_REQUIRED = 'false';
process.env.SMTP_HOST = '';
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-error-handling-${Date.now()}.db`);

const { withErrorHandling, globalErrorHandler } = require('../server');

describe('error handling utils', () => {
    test('withErrorHandling forwards sync exceptions to next', () => {
        const next = jest.fn();
        const wrapped = withErrorHandling(() => {
            throw new Error('sync boom');
        });

        wrapped({}, {}, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(next.mock.calls[0][0].message).toBe('sync boom');
    });

    test('withErrorHandling forwards async rejections to next', async () => {
        const next = jest.fn();
        const wrapped = withErrorHandling(async () => {
            throw new Error('async boom');
        });

        await wrapped({}, {}, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(next.mock.calls[0][0].message).toBe('async boom');
    });

    test('globalErrorHandler returns a generic 500 payload', () => {
        const req = { method: 'GET', originalUrl: '/api/test' };
        const res = {
            headersSent: false,
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        globalErrorHandler(new Error('db busy'), req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error.' });
    });
});
