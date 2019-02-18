# diversus-flower

The flower exports into the outer space a method:

```javascript
  this.putDiversusFlowerInElemOrId = function(elemOrId, props) {
    var elem = (typeof elemOrId == 'string') ? document.querySelector('#'+elemOrId) : elemOrId;
    return ReactDOM.render(React.createElement(DiversusFlower, props), elem);
  }
```

It returns a flower instance which responds to this API:

```

    zeFlower = putDiversusFlowerInElemOrId(elem, theFlowerPropsObj)
    // see props at: https://github.com/DIVERSUSandTIM/diversus-flower/blob/master/src/index.js#L506
    zeFlower.setRootPetal({thumbUrl: 'url of thumbnail for root', key: 'unique id among petals', color: 'color of root'})
    zeFlower.setRootClickHandler(flowerRootClickHandler)
    zeFlower.setPetalClickHandler(flowerPetalClickHandler)

    // each petal is added using the call
    zeFlower.addPetal(petalArgs)
    /*
     * where petalArgs has properties
     *    key: the unique identifier for the petal
     *    relPos: float between 0 and 1 meaning the clockwise position of the petal
     *    sortKey: a number between 0 and 1 indicating a partial ordering (collisions legal) indicating
     *             the precedence of the petal, where lower values place the petal closer to the center
     *    thumbUrl: the url of the thumbnail for the petal
     *    color: the color of the petal, presumably used for the perimeter
     */
    
```