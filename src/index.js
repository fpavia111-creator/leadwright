'use strict';
module.exports = {
  ...require('./engine'), ...require('./compliance'), ...require('./deliverability'),
  ...require('./suppression'), ...require('./audit'), ...require('./icp'), ...require('./config'),
  ...require('./export'), ...require('./prompts'), license: require('./license'), mcp: require('./mcp'),
};
