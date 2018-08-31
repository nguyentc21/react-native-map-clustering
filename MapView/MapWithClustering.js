import React, { Component } from 'react';
import PropTypes from 'prop-types';
import MapView from 'react-native-maps';
import { width as w, height as h } from 'react-native-dimension';
import SuperCluster from 'supercluster';
import CustomMarker from './CustomMarker';

export default class MapWithClustering extends Component {
  constructor(props) {
    super(props);

    this.state = {
      currentMarkerIndex: null
    };

    this.havePickedMarker = false
    this.clusterStyle = {
      borderRadius: w(15),
      backgroundColor: props.clusterColor,
      borderColor: props.clusterBorderColor,
      borderWidth: props.clusterBorderWidth,
      width: w(15),
      height: w(15),
      justifyContent: 'center',
      alignItems: 'center',
    }
    this.clusterTextStyle = {
      fontSize: props.clusterTextSize,
      color: props.clusterTextColor,
      fontWeight: 'bold',
    }
  }

  componentDidMount() {
    this.createMarkersOnMap();
  }

  componentWillReceiveProps() {
    this.createMarkersOnMap();
  }

  onRegionChangeComplete = (region) => {
    const { latitude, latitudeDelta, longitude, longitudeDelta } = this.props.currentRegion;
    if (region.longitudeDelta <= 80) {
      if ((Math.abs(region.latitudeDelta - latitudeDelta) > latitudeDelta / 8)
        || (Math.abs(region.longitude - longitude) >= longitudeDelta / 5)
        || (Math.abs(region.latitude - latitude) >= latitudeDelta / 5)) {
        this.calculateClustersForMap();
      }
    }
    const { onRegionChangeComplete } = this.props
    onRegionChangeComplete && onRegionChangeComplete(region, this.havePickedMarker)
  };

  createMarkersOnMap = () => {
    const markers = [];
    const otherChildren = [];
    const { count } = this.props

    React.Children.forEach(this.props.children, (marker) => {
      if (marker.props && marker.props.coordinate) {
        markers.push({
          marker,
          properties: { point_count: 0, type: marker.props.type },
          geometry: {
            type: 'Point',
            coordinates: [
              marker.props.coordinate.longitude,
              marker.props.coordinate.latitude,
            ],
          },
        });
      } else {
        otherChildren.push(marker);
      }
    });


    if (!this.superCluster) {
      if (count) {
        this.superCluster = SuperCluster({
          radius: this.props.radius,
          maxZoom: 20,
          minZoom: 1,
          initial: function() {
            let result = {}
            count.forEach(value => {
              result = { ...result, [value]: 0 }
            })
            return { count: {...result } }; 
          },
          map: function(props) {
            let result = {}
            count.forEach(value => {
              result = { ...result, [value]: 0 }
              if(props.type && props.type !== []) {
                props.type.forEach(t => {
                  if (t === value) {
                    result = { ...result, [value]: 1 }
                  } else {
                    result = { ...result, [value]: 0 }
                  }
                })
              }
            })
            return { count: {...result } }; 
          },
          reduce: function(accumulated, props) {
            count.forEach(value => {
              accumulated.count[value] += props.count[value]
            })
          }
        });
      } else {
        this.superCluster = SuperCluster({
          radius: this.props.radius,
          maxZoom: 20,
          minZoom: 1
        });
      }
    }
    this.superCluster.load(markers);

    this.setState({
      markers,
      otherChildren,
    }, () => {
      this.calculateClustersForMap();
    });
  };

  calculateBBox = region => [
    region.longitude - region.longitudeDelta, // westLng - min lng
    region.latitude - region.latitudeDelta, // southLat - min lat
    region.longitude + region.longitudeDelta , // eastLng - max lng
    region.latitude + region.latitudeDelta// northLat - max lat
  ];

  getBoundsZoomLevel = (bounds, mapDim) => {
    const WORLD_DIM = { height: mapDim.height, width: mapDim.width };
    const ZOOM_MAX = 20;

    function latRad(lat) {
      const sin = Math.sin(lat * Math.PI / 180);
      const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
      return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
    }

    function zoom(mapPx, worldPx, fraction) {
      return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
    }

    const latFraction = (latRad(bounds[3]) - latRad(bounds[1])) / Math.PI;
    const lngDiff = bounds[2] - bounds[0];
    const lngFraction = ((lngDiff < 0) ? (lngDiff + 360) : lngDiff) / 360;
    const latZoom = zoom(mapDim.height, WORLD_DIM.height, latFraction);
    const lngZoom = zoom(mapDim.width, WORLD_DIM.width, lngFraction);

    return Math.min(latZoom, lngZoom, ZOOM_MAX);
  };

  resetCurrentCluster = () => {
    this.setState({ currentMarkerIndex: null })
  }

  fixedNumber = (num) => (Number.parseFloat(num).toFixed(5))

  onClusterPress = (point_count, count) => index => e => {
    const { latitude, longitude } = e.nativeEvent.coordinate
    const { currentMarkerIndex } = this.state
    if (currentMarkerIndex) {
      const isSameLatitude =this.fixedNumber(currentMarkerIndex.latitude) == this.fixedNumber(latitude)
      const isSameLongitude =this.fixedNumber(currentMarkerIndex.longitude) == this.fixedNumber(longitude)
      if (isSameLatitude && isSameLongitude) {
        this.setState({ currentMarkerIndex: null })
        this.havePickedMarker = false
        return this.props.onClusterPress(null, e.nativeEvent)
      }
    }
    
    this.setState({ currentMarkerIndex: e.nativeEvent.coordinate })
    this.props.onClusterPress(point_count, e.nativeEvent, count)
  }

  calculateClustersForMap = async () => {
    let clusteredMarkers = [];

    if (this.props.clustering && this.superCluster) {
      const bBox = this.calculateBBox(this.props.currentRegion);
      let zoom = this.getBoundsZoomLevel(bBox, { height: h(100), width: w(100) });
      const clusters = await this.superCluster.getClusters([bBox[0], bBox[1], bBox[2], bBox[3]], zoom);
      const { currentMarkerIndex } = this.state;
      let isShowPickedCluster = false

      clusteredMarkers = clusters.map((cluster,index) => {
        const [longitude, latitude] = cluster.geometry.coordinates || [];

        let isCurrentMarker = false
        if (currentMarkerIndex) {
          const isSameLatitude =this.fixedNumber(currentMarkerIndex.latitude) == this.fixedNumber(latitude)
          const isSameLongitude =this.fixedNumber(currentMarkerIndex.longitude) == this.fixedNumber(longitude)
      
          isCurrentMarker = isSameLatitude && isSameLongitude
        }

        if (isCurrentMarker) {
          isShowPickedCluster = true
          this.havePickedMarker = true
        }
        const properties = cluster.properties || {}

        const isCounted = properties.count && this.props.clusterTypeWillChangeStyle &&
        properties.count[this.props.clusterTypeWillChangeStyle] > 0
        
        let clusterStyle = this.clusterStyle
        let clusterTextStyle = this.clusterTextStyle

        const currentClusterStyle = {
          backgroundColor: this.props.pickedClusterColor,
          borderColor: this.props.pickedClusterBorderColor,
          borderWidth: this.props.pickedClusterBorderWidth
        }
        const currentClusterTextStyle = {
          fontSize: this.props.pickedClusterTextSize,
          color: this.props.pickedClusterTextColor
        }

        if (!isCurrentMarker) {
          if (this.props.clusterStylesWithCounter && isCounted) {
            clusterStyle = {
              ...clusterStyle,
              backgroundColor: this.props.clusterStylesWithCounter.clusterColor,
              borderColor: this.props.clusterStylesWithCounter.clusterBorderColor,
              borderWidth: this.props.clusterStylesWithCounter.clusterBorderWidth
            }
            clusterTextStyle = {
              ...clusterTextStyle,
              fontSize: this.props.clusterStylesWithCounter.clusterTextSize,
              color: this.props.clusterStylesWithCounter.clusterTextColor
            }
          }
        }

        return <CustomMarker
          index={index}
          pointCount={properties.point_count}
          clusterId={properties.cluster_id}
          geometry={cluster.geometry}
          clusterStyle={clusterStyle}
          clusterTextStyle={clusterTextStyle}
          marker={properties.point_count === 0 ? cluster.marker : null}
          key={JSON.stringify(cluster.geometry) + properties.cluster_id + properties.point_count}
          onClusterPress={this.onClusterPress(properties.point_count, this.props.count && properties.count)}
          isShowPickedCluster={this.props.isShowPickedCluster}
          isCurrentMarker={isCurrentMarker}
          currentClusterStyle={currentClusterStyle}
          currentClusterTextStyle={currentClusterTextStyle}
        />
      }
    );

    if (!isShowPickedCluster) {
      this.havePickedMarker = false
    }

    } else {
      clusteredMarkers = this.state.markers.map(marker => marker.marker);
    }

    this.setState({
      clusteredMarkers
    });
  };

  removeChildrenFromProps = (props) => {
    const newProps = {};
    Object.keys(props).forEach((key) => {
      if (key !== 'children') {
        newProps[key] = props[key];
      }
    });
    return newProps;
  };

  render() {
    return (
      <MapView
        {...this.removeChildrenFromProps(this.props)}
        ref={this.props.onRef}
        onRegionChangeComplete={this.onRegionChangeComplete}
      >
        {this.state.clusteredMarkers}
        {this.state.otherChildren}
      </MapView>
    );
  }
}

MapWithClustering.propTypes = {
  region: PropTypes.object,
  clustering: PropTypes.bool,
  radius: PropTypes.number,
  clusterColor: PropTypes.string,
  clusterTextColor: PropTypes.string,
  clusterBorderColor: PropTypes.string,
  clusterBorderWidth: PropTypes.number,
  clusterTextSize: PropTypes.number,
  onClusterPress: PropTypes.func,
  isShowPickedCluster: PropTypes.bool
};

const totalSize = num => (Math.sqrt((h(100) * h(100)) + (w(100) * w(100))) * num) / 100;

MapWithClustering.defaultProps = {
  clustering: true,
  radius: w(5),
  clusterColor: '#F5F5F5',
  clusterTextColor: '#FF5252',
  clusterBorderColor: '#FF5252',
  clusterBorderWidth: 1,
  clusterTextSize: totalSize(2.4),
  onClusterPress: () => {},
  isShowPickedCluster: false
};
