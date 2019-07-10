# nbresuse

## how it works

1. alias self.settings['nbresuse_display_config'], this is an object <ResourceUseDisplay)
2. get the data you need, this is pulled from psutil
3. convert that dat into a dict
4. pass the data to write as a json to self.write()

## Objects

### ResourceUseDisplay(Configurable)
 
Server-side object that pulls memory so far. Can probably be extended to include new fields

### MetricsHandler(IPythonHandler)

Responsible for pulling, processing, and writing the data

## Functions

### _jupyter_server_extension_paths

Set up the server extension for collecting metrics.

It's basically the name of the package for installing it into a jupyter notebook

### _jupyter_nbextension_paths

Set up the notebook extension for displaying metrics

Contains various fields that are used to include into the notebook

### load_jupyter_server_extension(nbapp)

Called during notebook start.

1. creates a ResourceUseDisplayObject, and passes a parent=nbapp to it on construction. TODO figure out why
2. attach the object to nbapp.web_app.settings['nbresuse_display_confg']
3. create a route for this project, it's the base_url + /metrics
4. attach a handler to nbapp, contains the route and the metricshandler

## Questions

1. What's nbapp? (passed from load_jupyter_server_extension)
2. What's a Configurable? passed to ResourceUseDisplay

## Things to understand

1. tornado web server
2. traitlets
