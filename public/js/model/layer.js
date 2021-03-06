import Backbone from 'backbone';
import 'backbone-relational';
import Wreqr from 'backbone.wreqr';
import CONST from '../const';
import { uuid } from '../core/utils';

export default Backbone.RelationalModel.extend({
  defaults() {
    return {
      creationDate: new Date().toISOString(),
      modificationDate: new Date().toISOString(),
      uuid: undefined,
      type: CONST.layerType.overpass,
      name: undefined,
      description: undefined,
      visible: true,
      minZoom: 14,
      popupContent: undefined,
      order: undefined,

      // Point based layer specific
      rootLayerType: CONST.rootLayerType.markerCluster,
      markerShape: 'marker2',
      markerColor: 'green',
      markerIconType: CONST.map.markerIconType.library,
      markerIcon: undefined,
      markerIconUrl: undefined,
      heatMinOpacity: 0.05,
      heatMaxZoom: 18,
      heatMax: 1.0,
      heatBlur: 15,
      heatRadius: 25,

      // Shape files based layer specific
      fileUri: undefined,

      // Overpass type specific
      overpassRequest: undefined,
      cache: false,
      cacheUpdateSuccess: undefined,
      cacheUpdateSuccessDate: undefined,
      cacheUpdateDate: undefined,
      cacheUpdateError: undefined,
      cacheBounds: undefined,
      cacheArchive: false,

      locales: {
        /*
                fr: {
                    name: '',
                    description: '',
                }
            */
      }
    };
  },

  localizedAttributes: ['name', 'description', 'popupContent'],

  // GeoJSON objects displayed on the map
  _geoJsonObjects: {},

  _isCachedFeaturesFetched: false,
  _isArchivedFeaturesFetched: false,
  _isDeletedFeaturesFetched: false,
  _isModifiedFeaturesFetched: false,
  _cachedFeatures: [],
  _archivedFeatures: [],
  _deletedFeatures: [],
  _modifiedFeatures: [],

  initialize() {
    this._radio = Wreqr.radio.channel('global');

    if (!this.get('uuid')) {
      this.set('uuid', uuid());
    }

    if (Array.isArray(this.get('locales'))) {
      this.set('locales', {});
    }
  },

  updateModificationDate() {
    this.set('modificationDate', new Date().toISOString());
  },

  /**
   * Tells if the layer is visible.
   *
   * @author Guillaume AMAT
   * @return boolean
   */
  isVisible() {
    const isOwner = this._radio.reqres.request('user:isOwner');

    if (isOwner) {
      return true;
    }

    return this.get('visible');
  },

  /**
   * Merges the objects with the current displayed GeoJSON objects.
   *
   * @author Guillaume AMAT
   * @param {object} objects - GeoJSON objects
   */
  addObjects(objects) {
    this._geoJsonObjects = {
      ...this._geoJsonObjects,
      ...objects
    };
  },

  getObjects() {
    return this._geoJsonObjects;
  },

  async getCachedFeatures(fragment) {
    if (this._isCachedFeaturesFetched) {
      return this._cachedFeatures;
    }

    const archiveFileUrl = `/files/theme/${fragment}/overPassCache/${this.get(
      'uuid'
    )}.geojson`;

    this._isCachedFeaturesFetched = true;
    this._cachedFeatures = await fetch(archiveFileUrl)
      .then(res => res.json())
      .catch(() => []);

    return this._cachedFeatures;
  },

  async getModifiedFeatures(fragment) {
    if (this._isModifiedFeaturesFetched) {
      return this._modifiedFeatures;
    }

    const archiveFileUrl = `/files/theme/${fragment}/overPassCache/${this.get(
      'uuid'
    )}-modified.json`;

    this._isModifiedFeaturesFetched = true;
    this._modifiedFeatures = await fetch(archiveFileUrl)
      .then(res => res.json())
      .catch(() => []);

    return this._modifiedFeatures;
  },

  async getDeletedFeatures(fragment) {
    if (this._isDeletedFeaturesFetched) {
      return this._deletedFeatures;
    }

    const archiveFileUrl = `/files/theme/${fragment}/overPassCache/${this.get(
      'uuid'
    )}-deleted.json`;

    this._isDeletedFeaturesFetched = true;
    this._deletedFeatures = await fetch(archiveFileUrl)
      .then(res => res.json())
      .catch(() => []);

    return this._deletedFeatures;
  },

  async getArchivedFeatures(fragment) {
    if (this._isArchivedFeaturesFetched) {
      return this._archivedFeatures;
    }

    const archiveFileUrl = `/files/theme/${fragment}/overPassCache/${this.get(
      'uuid'
    )}-archived.json`;

    this._isArchivedFeaturesFetched = true;
    this._archivedFeatures = await fetch(archiveFileUrl)
      .then(res => res.json())
      .catch(() => []);

    return this._archivedFeatures;
  },

  removeDeletedFeature(fragment, feature, callApi) {
    this._deletedFeatures = this._deletedFeatures.filter(
      f => f.id !== feature.id
    );

    if (callApi) {
      const uuid = this.get('uuid');
      fetch(
        `${
          CONST.apiPath
        }/overPassCache/removeDeletedFeature/${fragment}/${uuid}/${feature.id}`
      );
    }
  },

  removeModifiedFeature(fragment, feature, callApi) {
    this._modifiedFeatures = this._modifiedFeatures.filter(
      f => f.id !== feature.id
    );

    if (callApi) {
      const uuid = this.get('uuid');
      fetch(
        `${
          CONST.apiPath
        }/overPassCache/removeModifiedFeature/${fragment}/${uuid}/${feature.id}`
      );
    }
  },

  mergeModifiedFeature(fragment, feature, callApi) {
    this._modifiedFeatures = this._modifiedFeatures.filter(
      f => f.id !== feature.id
    );

    this._cachedFeatures.features = this._cachedFeatures.features.filter(
      f => f.id !== feature.id
    );

    this._cachedFeatures.features.push(feature);

    if (callApi) {
      const uuid = this.get('uuid');
      fetch(
        `${
          CONST.apiPath
        }/overPassCache/mergeModifiedFeature/${fragment}/${uuid}/${feature.id}`
      );
    }
  },

  archiveFeatureFromDeletedCache(fragment, feature) {
    this._archivedFeatures.push(feature);

    const uuid = this.get('uuid');
    fetch(
      `${
        CONST.apiPath
      }/overPassCache/archiveFeatureFromDeletedCache/${fragment}/${uuid}/${
        feature.id
      }`
    );

    this.removeDeletedFeature(fragment, feature);
  },

  archiveFeatureFromModifiedCache(fragment, feature) {
    this._archivedFeatures.push(feature);

    const uuid = this.get('uuid');
    fetch(
      `${
        CONST.apiPath
      }/overPassCache/archiveFeatureFromModifiedCache/${fragment}/${uuid}/${
        feature.id
      }`
    );

    this.removeModifiedFeature(fragment, feature);
  },

  getLocaleCompletion(localeCode) {
    const locale = this.get('locales')[localeCode];
    const data = {
      items: this.localizedAttributes.length,
      completed: 0
    };

    if (!locale) {
      return data;
    }

    for (const attribute of this.localizedAttributes) {
      if (locale[attribute]) {
        data.completed += 1;
      }
    }

    return data;
  }
});
