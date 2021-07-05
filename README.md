
[![License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](https://github.com/arose/ngl/blob/master/LICENSE)
[![Changelog](https://img.shields.io/badge/changelog--lightgrey.svg?style=flat)](https://github.com/arose/ngl/blob/master/CHANGELOG.md)
[![npm version](https://badge.fury.io/js/ngl.svg)](https://badge.fury.io/js/ngl)
[![Build Status](https://travis-ci.org/arose/ngl.svg?branch=master)](https://travis-ci.org/arose/ngl)
[![Standard](https://img.shields.io/badge/code_style-standard-brightgreen.svg?style=flat)](https://standardjs.com)
[![Gitter](https://badges.gitter.im/nglviewer/Lobby.svg)](https://gitter.im/nglviewer/Lobby)
[![Code Quality: Javascript](https://img.shields.io/lgtm/grade/javascript/g/arose/ngl.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/arose/ngl/context:javascript)
[![Total Alerts](https://img.shields.io/lgtm/alerts/g/arose/ngl.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/arose/ngl/alerts)


NGL Viewer is a web application for molecular visualization. [WebGL](https://get.webgl.org/) is employed to display molecules like proteins and DNA/RNA with a variety of representations.

See it in action:

* [Web application](https://nglviewer.github.io/ngl/?script=showcase/ferredoxin)
* [X-ray viewer](https://codepen.io/arose/full/oWOQMg/)
* [Gallery](https://nglviewer.github.io/ngl/gallery/index.html)
* [CodePen template](https://codepen.io/pen?template=JNLMXb)
* [Pens tagged _ngl_](https://codepen.io/tag/ngl/)

Integration with python and R:

* [NGLView](https://github.com/nglviewer/nglview): Jupyter Notebook Widget 
* [NGLViewR](https://github.com/nvelden/NGLVieweR/) R htmlwidget (and an example [Shiny Application](https://niels-van-der-velden.shinyapps.io/shinyNGLVieweR/))

Documentation:

* [Reference](http://nglviewer.org/ngl/api/identifiers.html)
* [Manual](http://nglviewer.org/ngl/api/manual/index.html)


Features
--------

* Molecular structures (mmCIF, PDB, PQR, GRO, SDF, MOL2, MMTF)
* Density volumes (MRC/MAP/CCP4, DX/DXBIN, CUBE, BRIX/DSN6, XPLOR/CNS)
* User interaction (mouse picking, selection language, animation, image export)
* Coordinate trajectories (DCD & PSF, NCTRAJ & PRMTOP, TRR/XTC & TOP, remote access via [MDSrv](https://github.com/arose/mdsrv/))
* Embeddable (single file, API)


Usage
-----

Since the NGL Viewer is a set of static files to be viewed in a web-browser there is not much of an installation needed. For development purposes it will be helpful to clone this repository and serve it locally (see below). When embedding the NGL Viewer as a library it is sufficient to include the self contained build [dist/ngl.js](dist/ngl.js). A full web application including a GUI can be found in the [examples](examples/) directory.

To install the current release from npm do `npm install ngl`. To install a development release from npm do `npm install ngl@next` or `npm install ngl@ts2`.

Acknowledgments
---------------

This project would not be possible without many fine open-source projects. Especially the [three.js](http://threejs.org/) project provides a great foundation.

* [three.js](http://threejs.org/)
    * NGL relies on the three.js library to interface WebGL
    * NGL's GUI is based on the three.js editor UI
* [sprintf.js](https://github.com/alexei/sprintf.js) - for formatting text
* [jsfeat](http://inspirit.github.io/jsfeat/) - the SVD code for the superposition method is from jsfeat
* [ESDoc](https://esdoc.org/) - for documentation
* [Jest](https://jest.io/) and [ts-jest](https://github.com/kulshekhar/ts-jest) - for unit testing
* [Chroma.js](https://github.com/gka/chroma.js) - for color handling
* [FlexiColorPicker](https://github.com/DavidDurman/FlexiColorPicker) - for color picking
* [Virtual DOM List](https://github.com/sergi/virtual-list)
* [Font Awesome](http://fontawesome.io) - for icons
* [JS Signals](http://millermedeiros.github.com/js-signals)
* [tether.js](http://github.hubspot.com/tether/)
* [Lightweight promise polyfill](https://github.com/taylorhakes/promise-polyfill)
* [pako - zlib port](https://github.com/nodeca/pako)
* [Open Source PyMOL](http://sourceforge.net/projects/pymol/) - screen aligned cylinder shader
* [VTK](http://www.vtk.org/) Quadric shader code from the PointSprite Plugin - quadric surface center calculation
* [HyperBalls](http://sourceforge.net/projects/hyperballs/) - hyperball stick shader - Chavent, M., Vanel, A., Tek, A., Levy, B., Robert, S., Raffin, B., &amp; Baaden, M. (2011). GPU-accelerated atom and dynamic bond visualization using hyperballs: a unified algorithm for balls, sticks, and hyperboloids. Journal of Computational Chemistry, 32(13), 2924–35. [doi:10.1002/jcc.21861](https://dx.doi.org/10.1002/jcc.21861)


Funding sources:

* [RCSB PDB](https://www.rcsb.org) funding by a grant [DBI-1338415; PI: SK Burley] from the NSF, the NIH, and the US DoE
* NCI/NIH award number U01 CA198942
* DFG Projekt HI 1502


Cite
----

When using NGL please cite:

* AS Rose, AR Bradley, Y Valasatava, JM Duarte, A Prlić and PW Rose. _NGL viewer: web-based molecular graphics for large complexes._ Bioinformatics: bty419, 2018. [doi:10.1093/bioinformatics/bty419](http://dx.doi.org/10.1093/bioinformatics/bty419)
* AS Rose and PW Hildebrand. _NGL Viewer: a web application for molecular visualization._ Nucl Acids Res (1 July 2015) 43 (W1): W576-W579 first published online April 29, 2015. [doi:10.1093/nar/gkv402](https://doi.org/10.1093/nar/gkv402)
