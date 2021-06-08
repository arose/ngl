// Handle window resizing
window.addEventListener('resize', function () {
  stage.handleResize()
}, false)

var newDiv = document.getElementById('viewport').appendChild(document.createElement('div'))
newDiv.setAttribute('style', 'position: absolute; top: 0; left: 20px')
newDiv.innerHTML = `<div class="controls"><h3>Example Cross-Links over Human Serum Albumin</h3><p class="credit">Data courtessy of Adam Belsom, Rappsilber Lab</p><p>Cross-Link Quality Filter </p><span id="minValue"></span><input type="range" min="0" max="10" step="0.1" value="0" id="scoreSlider" class="mySlider"></input><span id="maxValue"></span></div>`

// example crosslink data
var links = [{
  'atoms': [3296, 3924],
  'data': {
    'score': 19
  }
}, {
  'atoms': [1497, 3368],
  'data': {
    'score': 17.34
  }
}, {
  'atoms': [955, 1278],
  'data': {
    'score': 17.32
  }
}, {
  'atoms': [1004, 1290],
  'data': {
    'score': 17.03
  }
}, {
  'atoms': [1029, 1290],
  'data': {
    'score': 16.94
  }
}, {
  'atoms': [2077, 2257],
  'data': {
    'score': 16.5
  }
}, {
  'atoms': [1641, 2767],
  'data': {
    'score': 15.92
  }
}, {
  'atoms': [3287, 3924],
  'data': {
    'score': 15.83
  }
}, {
  'atoms': [2687, 2850],
  'data': {
    'score': 15.73
  }
}, {
  'atoms': [949, 1290],
  'data': {
    'score': 15.7
  }
}, {
  'atoms': [1040, 1290],
  'data': {
    'score': 15.23
  }
}, {
  'atoms': [949, 1278],
  'data': {
    'score': 15.16
  }
}, {
  'atoms': [306, 541],
  'data': {
    'score': 14.69
  }
}, {
  'atoms': [1004, 1278],
  'data': {
    'score': 14.5
  }
}, {
  'atoms': [1013, 1290],
  'data': {
    'score': 14.37
  }
}, {
  'atoms': [3183, 4328],
  'data': {
    'score': 14.19
  }
}, {
  'atoms': [1884, 1900],
  'data': {
    'score': 13.99
  }
}, {
  'atoms': [812, 3684],
  'data': {
    'score': 13.94
  }
}, {
  'atoms': [1013, 1258],
  'data': {
    'score': 13.89
  }
}, {
  'atoms': [3384, 4113],
  'data': {
    'score': 13.78
  }
}, {
  'atoms': [3303, 3924],
  'data': {
    'score': 13.69
  }
}, {
  'atoms': [1497, 3377],
  'data': {
    'score': 13.42
  }
}, {
  'atoms': [329, 541],
  'data': {
    'score': 13.4
  }
}, {
  'atoms': [955, 1309],
  'data': {
    'score': 13.38
  }
}, {
  'atoms': [89, 1278],
  'data': {
    'score': 13.35
  }
}, {
  'atoms': [462, 479],
  'data': {
    'score': 13.17
  }
}, {
  'atoms': [399, 541],
  'data': {
    'score': 13.14
  }
}, {
  'atoms': [1493, 1511],
  'data': {
    'score': 13.11
  }
}, {
  'atoms': [1497, 3361],
  'data': {
    'score': 13.09
  }
}, {
  'atoms': [688, 742],
  'data': {
    'score': 13.08
  }
}, {
  'atoms': [321, 541],
  'data': {
    'score': 13.05
  }
}, {
  'atoms': [2850, 2983],
  'data': {
    'score': 13.02
  }
}, {
  'atoms': [1194, 1565],
  'data': {
    'score': 13
  }
}, {
  'atoms': [996, 1290],
  'data': {
    'score': 12.91
  }
}, {
  'atoms': [1497, 3571],
  'data': {
    'score': 12.76
  }
}, {
  'atoms': [98, 1258],
  'data': {
    'score': 12.74
  }
}, {
  'atoms': [77, 1290],
  'data': {
    'score': 12.72
  }
}, {
  'atoms': [263, 1057],
  'data': {
    'score': 12.69
  }
}, {
  'atoms': [955, 1231],
  'data': {
    'score': 12.68
  }
}, {
  'atoms': [955, 1290],
  'data': {
    'score': 12.66
  }
}, {
  'atoms': [1215, 1278],
  'data': {
    'score': 12.62
  }
}, {
  'atoms': [1668, 1831],
  'data': {
    'score': 12.56
  }
}, {
  'atoms': [69, 1258],
  'data': {
    'score': 12.47
  }
}, {
  'atoms': [3943, 4001],
  'data': {
    'score': 12.46
  }
}, {
  'atoms': [955, 1258],
  'data': {
    'score': 12.39
  }
}, {
  'atoms': [967, 1290],
  'data': {
    'score': 12.33
  }
}, {
  'atoms': [1493, 3346],
  'data': {
    'score': 12.32
  }
}, {
  'atoms': [2065, 2308],
  'data': {
    'score': 12.23
  }
}, {
  'atoms': [1632, 2767],
  'data': {
    'score': 12.2
  }
}, {
  'atoms': [1004, 1258],
  'data': {
    'score': 12.16
  }
}, {
  'atoms': [1565, 2362],
  'data': {
    'score': 12.15
  }
}, {
  'atoms': [77, 1258],
  'data': {
    'score': 12.09
  }
}, {
  'atoms': [1159, 1557],
  'data': {
    'score': 12.04
  }
}, {
  'atoms': [1652, 2767],
  'data': {
    'score': 12.03
  }
}, {
  'atoms': [4412, 4510],
  'data': {
    'score': 11.95
  }
}, {
  'atoms': [1242, 1565],
  'data': {
    'score': 11.95
  }
}, {
  'atoms': [3353, 3421],
  'data': {
    'score': 11.93
  }
}, {
  'atoms': [2861, 2983],
  'data': {
    'score': 11.87
  }
}, {
  'atoms': [3992, 4159],
  'data': {
    'score': 11.79
  }
}, {
  'atoms': [949, 1258],
  'data': {
    'score': 11.75
  }
}, {
  'atoms': [1517, 1546],
  'data': {
    'score': 11.74
  }
}, {
  'atoms': [2687, 2937],
  'data': {
    'score': 11.71
  }
}, {
  'atoms': [2065, 2350],
  'data': {
    'score': 11.6
  }
}, {
  'atoms': [4026, 4159],
  'data': {
    'score': 11.59
  }
}, {
  'atoms': [2065, 2301],
  'data': {
    'score': 11.59
  }
}, {
  'atoms': [3368, 3421],
  'data': {
    'score': 11.56
  }
}, {
  'atoms': [1668, 2767],
  'data': {
    'score': 11.53
  }
}, {
  'atoms': [988, 1290],
  'data': {
    'score': 11.52
  }
}, {
  'atoms': [3753, 3936],
  'data': {
    'score': 11.51
  }
}, {
  'atoms': [1223, 1565],
  'data': {
    'score': 11.46
  }
}, {
  'atoms': [69, 377],
  'data': {
    'score': 11.43
  }
}, {
  'atoms': [4340, 4433],
  'data': {
    'score': 11.39
  }
}, {
  'atoms': [3987, 4159],
  'data': {
    'score': 11.3
  }
}, {
  'atoms': [2679, 3508],
  'data': {
    'score': 11.29
  }
}, {
  'atoms': [2056, 3121],
  'data': {
    'score': 11.25
  }
}, {
  'atoms': [2523, 2767],
  'data': {
    'score': 11.21
  }
}, {
  'atoms': [3762, 4463],
  'data': {
    'score': 11.2
  }
}, {
  'atoms': [3287, 3908],
  'data': {
    'score': 11.15
  }
}, {
  'atoms': [49, 470],
  'data': {
    'score': 11.11
  }
}, {
  'atoms': [49, 1048],
  'data': {
    'score': 11.07
  }
}, {
  'atoms': [2051, 2065],
  'data': {
    'score': 11.04
  }
}, {
  'atoms': [2528, 2795],
  'data': {
    'score': 10.99
  }
}, {
  'atoms': [2065, 2239],
  'data': {
    'score': 10.96
  }
}, {
  'atoms': [2065, 2342],
  'data': {
    'score': 10.92
  }
}, {
  'atoms': [1608, 3604],
  'data': {
    'score': 10.91
  }
}, {
  'atoms': [49, 1258],
  'data': {
    'score': 10.9
  }
}, {
  'atoms': [1497, 1591],
  'data': {
    'score': 10.8
  }
}, {
  'atoms': [4519, 4541],
  'data': {
    'score': 10.77
  }
}, {
  'atoms': [1215, 1565],
  'data': {
    'score': 10.77
  }
}, {
  'atoms': [3441, 3456],
  'data': {
    'score': 10.72
  }
}, {
  'atoms': [4001, 4168],
  'data': {
    'score': 10.69
  }
}, {
  'atoms': [3924, 4256],
  'data': {
    'score': 10.55
  }
}, {
  'atoms': [1432, 1565],
  'data': {
    'score': 10.51
  }
}, {
  'atoms': [1608, 1657],
  'data': {
    'score': 10.45
  }
}, {
  'atoms': [688, 784],
  'data': {
    'score': 10.44
  }
}, {
  'atoms': [4159, 4328],
  'data': {
    'score': 10.41
  }
}, {
  'atoms': [3746, 3762],
  'data': {
    'score': 10.35
  }
}, {
  'atoms': [1457, 1497],
  'data': {
    'score': 10.34
  }
}, {
  'atoms': [955, 1375],
  'data': {
    'score': 10.33
  }
}, {
  'atoms': [3183, 3401],
  'data': {
    'score': 10.28
  }
}, {
  'atoms': [49, 1278],
  'data': {
    'score': 10.24
  }
}, {
  'atoms': [69, 1290],
  'data': {
    'score': 10.11
  }
}, {
  'atoms': [3441, 3477],
  'data': {
    'score': 10.09
  }
}, {
  'atoms': [1040, 1066],
  'data': {
    'score': 10.05
  }
}, {
  'atoms': [2767, 3762],
  'data': {
    'score': 10.05
  }
}, {
  'atoms': [1, 419],
  'data': {
    'score': 9.94
  }
}, {
  'atoms': [1565, 2301],
  'data': {
    'score': 9.88
  }
}, {
  'atoms': [2537, 2804],
  'data': {
    'score': 9.86
  }
}, {
  'atoms': [4328, 4541],
  'data': {
    'score': 9.83
  }
}, {
  'atoms': [1048, 1066],
  'data': {
    'score': 9.8
  }
}, {
  'atoms': [107, 1258],
  'data': {
    'score': 9.79
  }
}, {
  'atoms': [3278, 3900],
  'data': {
    'score': 9.75
  }
}, {
  'atoms': [60, 406],
  'data': {
    'score': 9.74
  }
}, {
  'atoms': [1617, 2767],
  'data': {
    'score': 9.71
  }
}, {
  'atoms': [3943, 4019],
  'data': {
    'score': 9.68
  }
}, {
  'atoms': [2835, 2972],
  'data': {
    'score': 9.63
  }
}, {
  'atoms': [49, 1290],
  'data': {
    'score': 9.57
  }
}, {
  'atoms': [4403, 4463],
  'data': {
    'score': 9.37
  }
}, {
  'atoms': [1448, 3571],
  'data': {
    'score': 9.33
  }
}, {
  'atoms': [2662, 3421],
  'data': {
    'score': 9.31
  }
}, {
  'atoms': [1, 49],
  'data': {
    'score': 9.29
  }
}, {
  'atoms': [3296, 3421],
  'data': {
    'score': 9.27
  }
}, {
  'atoms': [60, 949],
  'data': {
    'score': 9.17
  }
}, {
  'atoms': [1517, 1565],
  'data': {
    'score': 9.15
  }
}, {
  'atoms': [3421, 3477],
  'data': {
    'score': 9.11
  }
}, {
  'atoms': [4052, 4177],
  'data': {
    'score': 9.11
  }
}, {
  'atoms': [3113, 3468],
  'data': {
    'score': 9.11
  }
}, {
  'atoms': [503, 550],
  'data': {
    'score': 9.07
  }
}, {
  'atoms': [2528, 2818],
  'data': {
    'score': 9.06
  }
}, {
  'atoms': [1057, 1290],
  'data': {
    'score': 8.93
  }
}, {
  'atoms': [4256, 4277],
  'data': {
    'score': 8.9
  }
}, {
  'atoms': [2826, 2911],
  'data': {
    'score': 8.75
  }
}, {
  'atoms': [1497, 3384],
  'data': {
    'score': 8.67
  }
}, {
  'atoms': [3121, 3421],
  'data': {
    'score': 8.64
  }
}, {
  'atoms': [529, 564],
  'data': {
    'score': 8.5
  }
}, {
  'atoms': [60, 1299],
  'data': {
    'score': 8.49
  }
}, {
  'atoms': [3917, 4256],
  'data': {
    'score': 8.48
  }
}, {
  'atoms': [1493, 1517],
  'data': {
    'score': 8.39
  }
}, {
  'atoms': [1511, 1557],
  'data': {
    'score': 8.31
  }
}, {
  'atoms': [1506, 1565],
  'data': {
    'score': 8.3
  }
}, {
  'atoms': [1432, 3421],
  'data': {
    'score': 8.3
  }
}, {
  'atoms': [60, 399],
  'data': {
    'score': 8.29
  }
}, {
  'atoms': [3924, 4272],
  'data': {
    'score': 8.26
  }
}, {
  'atoms': [1497, 3430],
  'data': {
    'score': 8.24
  }
}, {
  'atoms': [2662, 3774],
  'data': {
    'score': 8.19
  }
}, {
  'atoms': [60, 1304],
  'data': {
    'score': 7.88
  }
}, {
  'atoms': [1497, 3707],
  'data': {
    'score': 7.6
  }
}, {
  'atoms': [3150, 3421],
  'data': {
    'score': 7.46
  }
}, {
  'atoms': [3332, 3421],
  'data': {
    'score': 7.41
  }
}, {
  'atoms': [2687, 3503],
  'data': {
    'score': 6.81
  }
}]

var reps = {} // store ngl representations

// make a map of the links accessible by atom indices for use in colour scheme stuff
var linkMap = {}
links.forEach(function (link) {
  var atoms = link.atoms
  linkMap[atoms[0] + '-' + atoms[1]] = link
})

// make a colour scheme that grabs the score of each link and uses it to return a colour
var initColourSchemes = function () {
  var linkColourScheme = function () {
    var colCache = {}

    this.bondColor = function (b) {
      var origLink = linkMap[b.atomIndex1 + '-' + b.atomIndex2]

      if (origLink) {
        var score = origLink.data.score
        var col24bit = colCache[score]
        if (col24bit === undefined) {
          var i = score < valStops[1] ? 1 : 2
          var pct = (score - valStops[i - 1]) / (valStops[i] - valStops[i - 1])
          var col3 = {}
          // aargh semi-colon needed at start of line
          ;['r', 'g', 'b'].forEach(function (chan) {
            col3[chan] = colStops[i - 1][chan] + (colStops[i][chan] - colStops[i - 1][chan]) * pct
          })
          col24bit = col3 ? (col3.r << 16) + (col3.g << 8) + col3.b : 255
          colCache[score] = col24bit
        }
        return col24bit
      }
      return (128 << 16) + (128 << 8) + 128 // grey default
    }
  }

  reps.linkColourScheme = NGL.ColormakerRegistry.addScheme(linkColourScheme, 'xlink')
}
initColourSchemes()

// return unique atom indices as a selection from a set of pairs of atom indices
var makeAtomSelection = function (someLinks) {
  var atomSet = new Set()
  someLinks.forEach(function (link) {
    atomSet.add(link.atoms[0])
    atomSet.add(link.atoms[1])
  })
  var atomSelection = '@' + Array.from(atomSet).join(',')
  return atomSelection
}

// calculate extremes of score distribution for setting up initial slider and colour scale values
var min = Number.POSITIVE_INFINITY
var max = Number.NEGATIVE_INFINITY
links.forEach(function (link) {
  var score = link.data.score
  if (score !== undefined && score < min) { min = score }
  if (score !== undefined && score > max) { max = score }
})
document.getElementById('scoreSlider').min = min
document.getElementById('scoreSlider').max = max + 1
document.getElementById('minValue').textContent = min
document.getElementById('maxValue').textContent = max + 1

var colStops = [{r: 0, g: 0, b: 128}, {r: 128, g: 255, b: 255}, {r: 255, g: 255, b: 0}]
var valStops = [min, (min + max) / 2, max]

// listener for dragging slider, filter out links with score values smaller than slider value
document.getElementById('scoreSlider').addEventListener('input', function (evt) {
  var val = +evt.target.value
  var filteredLinks = links.filter(function (link) {
    return link.data.score >= val
  })
  reps.links.setParameters({
    atomPair: filteredLinks.map(function (fl) {
      return fl.atoms
    })
  })
  reps.residues.setSelection(makeAtomSelection(filteredLinks))
})

// initial atom selection for residues
var startAtomSel = makeAtomSelection(links)

// load pdb file and set up representations
stage.loadFile('rcsb://1AO6', {
  sele: ':A'
}).then(function (o) { // restrict to 1 chain cos links are on the monomer
  o.addRepresentation('cartoon', {
    color: '#666'
  })

  var baseLinkScale = 3

  reps.links = o.addRepresentation('distance', {
    atomPair: links.map(function (l) {
      return l.atoms
    }),
    // colorValue: 'yellow',
    colorScheme: reps.linkColourScheme,
    labelSize: 4,
    labelColor: 'white',
    labelVisible: true,
    labelUnit: 'angstrom',
    radiusScale: baseLinkScale,
    opacity: 1,
    name: 'link',
    side: 'front',
    useCylinder: true
  })

  reps.residues = o.addRepresentation('spacefill', {
    sele: startAtomSel,
    color: '#ccc',
    // colorScale: ['#44f', '#444'],
    radiusScale: 0.6,
    name: 'res'
  })

  o.autoView(':A') // center on chain A
})
