export function GET() {
    return {
        message: 'আধার চলছে',
        try: ['GET /api/notes', 'POST /api/notes', 'GET /api/notes/1', 'GET /api/stats'],
    };
}
