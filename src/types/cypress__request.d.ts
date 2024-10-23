declare module '@cypress/request' {
    import request, { RequestCallback, CoreOptions, Request } from "request"
    export function get(uri: string, options?: CoreOptions & { allowInsecureRedirect: true }, callback?: RequestCallback): Request
    export default request
}
