export default {
  async fetch(request: Request, env: any): Promise<Response> {
    return new Response('Placement Test Worker', { status: 200 });
  },
};
