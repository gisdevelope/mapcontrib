
import Wreqr from 'backbone.wreqr';
import Marionette from 'backbone.marionette';
import ContribNodeTagsListView from 'ui/form/contribNodeTags';
import ContributionErrorNotificationView from 'view/contributionErrorNotification';
import template from 'templates/contribute/add/formColumn.ejs';
import osmAuth from 'osm-auth';
import OsmEditHelper from 'helper/osmEdit.js';
import LayerModel from 'model/layer';
import NonOsmDataModel from 'model/nonOsmData';
import OsmCacheModel from 'model/osmCache';
import TagModel from 'model/tag';
import CONST from 'const';
import MapUi from 'ui/map';
import L from 'leaflet';


export default Marionette.LayoutView.extend({
    template,

    behaviors() {
        return {
            l20n: {},
            column: {
                appendToBody: true,
                destroyOnClose: true,
                routeOnClose: this.options.previousRoute,
            },
        };
    },

    regions: {
        tagList: '.rg_tag_list',
    },

    ui: {
        column: '.column',
        bottom: '.bottom',
        form: 'form',
        content: '.content',
        addBtn: '.add_btn',
        footerButtons: '.sticky-footer button',
    },

    events: {
        'click @ui.addBtn': 'onClickAddBtn',
        submit: 'onSubmit',
    },

    templateHelpers() {
        return {
            fragment: this._theme.get('fragment'),
            apiPath: `${CONST.apiPath}/file/nonOsmData`,
        };
    },

    initialize() {
        this._radio = Wreqr.radio.channel('global');
        this._map = this._radio.reqres.request('map');
        this._config = this.options.config;
        this._theme = this.options.theme;
        this._iDPresetsHelper = this.options.iDPresetsHelper;
        this._nonOsmData = this.options.nonOsmData;
        this._osmCache = this.options.osmCache;
        this._user = this.options.user;
        this._center = this.options.center;

        this._osmEdit = new OsmEditHelper(
            osmAuth({
                url: this._config.oauthEndPoint,
                oauth_consumer_key: this._config.oauthConsumerKey,
                oauth_secret: this._config.oauthSecret,
                oauth_token: this._user.get('token'),
                oauth_token_secret: this._user.get('tokenSecret'),
            })
        );
    },

    _buildNewMarker(latLng) {
        const pos = new L.LatLng(
            latLng.lat,
            latLng.lng
        );

        const icon = MapUi.buildLayerIcon(
            new LayerModel({
                markerShape: this._config.newPoiMarkerShape,
                markerIconType: CONST.map.markerIconType.library,
                markerIcon: this._config.newPoiMarkerIcon,
                markerColor: this._config.newPoiMarkerColor,
            })
        );

        return L.marker(pos, { icon });
    },

    onBeforeOpen() {
        this._radio.vent.trigger('column:closeAll', [ this.cid ]);
        this._radio.vent.trigger('widget:closeAll', [ this.cid ]);
    },

    open() {
        this.triggerMethod('open');
        return this;
    },

    onBeforeClose() {
        if (!this._contributionSent) {
            this._map.removeLayer( this._layer );
        }
    },

    close() {
        this.triggerMethod('close');
        return this;
    },

    onRender() {
        this._layer = this._buildNewMarker( this._center );
        this._map.addLayer( this._layer );

        this._tagList = new ContribNodeTagsListView({
            iDPresetsHelper: this.options.iDPresetsHelper,
            customTags: this.options.theme.get('tags'),
        });

        switch (typeof this.options.preset) {
            case 'object':
                for (const tag of this.options.preset.get('tags')) {
                    this._tagList.addTag(tag);
                }
                break;
            case 'string':
                const preset = this._iDPresetsHelper.getPreset(this.options.preset);

                for (const fieldName of preset.fields) {
                    if ({}.hasOwnProperty.bind(preset.fields, fieldName)) {
                        const field = this._iDPresetsHelper.getField(fieldName);

                        // FIXME - Have to take care of that case
                        if (!field.key) {
                            continue;
                        }

                        this._tagList.addTag(
                            new TagModel({
                                key: field.key,
                                type: field.type,
                            })
                        );
                    }
                }
                for (const tagName in preset.tags) {
                    if ({}.hasOwnProperty.bind(preset.tags, tagName)) {
                        let value = preset.tags[tagName];

                        if (value === '*') {
                            value = '';
                        }

                        this._tagList.addTag(
                            new TagModel({
                                key: tagName,
                                value,
                            })
                        );
                    }
                }
                break;
            default:
                this._tagList.addTag();
        }

        this.getRegion('tagList').show( this._tagList );
    },

    onClickAddBtn() {
        this._tagList.addTag();
        this._scrollToBottom();
    },

    _scrollToBottom() {
        window.requestAnimationFrame(() => {
            this.ui.bottom[0].scrollIntoView({ behavior: 'smooth' });
        });
    },

    onSubmit(e) {
        e.preventDefault();

        this.ui.footerButtons.prop('disabled', true);

        this._tagList.hideErrorFeedbacks();

        const hasFilesToUpload = this._tagList.hasFileToUpload();

        if ( hasFilesToUpload ) {
            this.ui.form.ajaxSubmit({
                error: (xhr) => {
                    switch (xhr.status) {
                        case 413:
                            this._tagList.showErrorFeedback(xhr.responseJSON);
                            break;
                        default:
                            this._tagList.showErrorFeedback(xhr.responseJSON);
                    }
                },
                success: (response) => {
                    this._tagList.setFilesPathFromApiResponse(response);
                    this.saveLayer();
                },
            });
        }
        else {
            this.saveLayer();
        }
    },

    saveLayer() {
        const createdBy = CONST.osm.changesetCreatedBy
        .replace('{version}', MAPCONTRIB.version);
        const tags = this._tagList.getTags();
        const osmTags = {};
        const nonOsmTags = [];

        for (const tag of tags) {
            if (tag.nonOsmData) {
                nonOsmTags.push({
                    key: tag.key,
                    value: tag.value,
                    type: tag.type,
                });
            }
            else {
                if (!tag.key || !tag.value) {
                    continue;
                }

                osmTags[tag.key] = tag.value;
            }
        }

        this._nonOsmDataModel = new NonOsmDataModel();
        this._nonOsmDataModel.updateModificationDate();
        this._nonOsmDataModel.set('osmType', 'node');
        this._nonOsmDataModel.set('userId', this.options.user.get('osmId'));
        this._nonOsmDataModel.set('themeFragment', this._theme.get('fragment'));
        this._nonOsmDataModel.set('tags', nonOsmTags);

        this._osmEdit.setChangesetCreatedBy(createdBy);
        this._osmEdit.setChangesetComment(CONST.osm.changesetComment);
        this._osmEdit.setType('node');
        this._osmEdit.setVersion(0);
        this._osmEdit.setTimestamp();
        this._osmEdit.setLatitude(this._center.lat);
        this._osmEdit.setLongitude(this._center.lng);
        this._osmEdit.setTags(osmTags);
        this._osmEdit.setUid(this.options.user.get('osmId'));
        this._osmEdit.setDisplayName(this.options.user.get('displayName'));

        this.sendContributionToOSM();
    },

    sendContributionToOSM() {
        this._osmEdit.send()
        .then((osmId) => {
            this.ui.footerButtons.prop('disabled', false);

            this._contributionSent = true;

            this._nonOsmDataModel.set('osmId', osmId);

            this._osmCacheModel = new OsmCacheModel();
            this._osmCacheModel.updateModificationDate();
            this._osmCacheModel.set('osmId', osmId);
            this._osmCacheModel.set('osmType', 'node');
            this._osmCacheModel.set('osmVersion', 0);
            this._osmCacheModel.set('osmElement', this._osmEdit.getElement());
            this._osmCacheModel.set('overPassElement', this._osmEdit.getOverPassElement());
            this._osmCacheModel.set('userId', this.options.user.get('osmId'));
            this._osmCacheModel.set('themeFragment', this._theme.get('fragment'));

            this._nonOsmData.add( this._nonOsmDataModel );
            this._osmCache.add( this._osmCacheModel );

            this._nonOsmDataModel.save();
            this._osmCacheModel.save();

            this.close();
        })
        .catch((err) => {
            console.error(err);

            this.ui.footerButtons.prop('disabled', false);

            new ContributionErrorNotificationView({
                retryCallback: this.sendContributionToOSM.bind(this),
            }).open();
        });
    },
});