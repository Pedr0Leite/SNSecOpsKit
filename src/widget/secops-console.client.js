api.controller = function ($scope) {
    /**
     * Connector console - client controller.
     *
     * Deliberately thin: it renders what the server sent and asks the server to act. Every
     * permission decision is made server-side, so nothing here is a security control.
     */
    var c = this

    c.testing = null

    c.testConnection = function (connector) {
        if (!connector || !connector.sys_id || c.testing) {
            return
        }

        c.testing = connector.sys_id

        c.server
            .update({ action: 'test_connection', connector: connector.sys_id })
            .then(function () {
                c.testing = null
            })
            .catch(function () {
                c.testing = null
            })
    }
}
