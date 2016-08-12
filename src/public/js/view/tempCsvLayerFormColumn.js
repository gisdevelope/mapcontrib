
import Wreqr from 'backbone.wreqr';
import Marionette from 'backbone.marionette';
import MapUi from '../ui/map';
import { basename, extensionname } from '../core/utils';
import CONST from '../const';
import template from '../../templates/tempCsvLayerFormColumn.ejs';
import MarkedHelper from '../helper/marked';


export default Marionette.ItemView.extend({
    template: template,

    behaviors: {
        'l20n': {},
        'column': {
            'destroyOnClose': true,
        },
    },

    ui: {
        'column': '#edit_temp_layer_column',
        'form': 'form',

        'layerName': '#layer_name',
        'layerDescription': '#layer_description',
        'infoDisplayInfo': '.info_info_display_btn',
        'layerPopupContent': '#layer_popup_content',
        'layerFile': '#layer_file',

        'markerWrapper': '.marker-wrapper',
        'editMarkerButton': '.edit_marker_btn',

        'formGroups': '.form-group',
        'fileFormGroup': '.form-group.layer_file',

        'currentFile': '.current_file',
    },

    events: {
        'click @ui.editMarkerButton': 'onClickEditMarker',
        'submit': 'onSubmit',
        'reset': 'onReset',
    },

    templateHelpers() {
        return {
            'marker': MapUi.buildLayerHtmlIcon( this.model ),
        };
    },

    initialize() {
        this._radio = Wreqr.radio.channel('global');

        this._oldModel = this.model.clone();

        this.listenTo(this.model, 'change', this.updateMarkerIcon);
    },

    onRender() {
        if ( this.model.get('fileUri') ) {
            const fileUri = this.model.get('fileUri');
            const fileName = basename(fileUri || '');

            this.ui.currentFile
            .html(
                document.l10n.getSync('currentFile', {
                    file: `<a href="${fileUri}" target="_blank">${fileName}</a>`
                })
            )
            .removeClass('hide');
        }
    },

    onShow() {
        this.ui.infoDisplayInfo.popover({
            'container': 'body',
            'placement': 'left',
            'trigger': 'focus',
            'html': true,
            'title': document.l10n.getSync('editLayerFormColumn_infoDisplayPopoverTitle'),
            'content': MarkedHelper.render(
                document.l10n.getSync('editLayerFormColumn_infoDisplayPopoverContent')
            ),
        });

        this.ui.layerFile.filestyle({
            'icon': false,
            'badge': false,
            'buttonText': document.l10n.getSync('editLayerFormColumn_browse'),
        });
    },

    open() {
        this.triggerMethod('open');
        return this;
    },

    close() {
        this.triggerMethod('close');
        return this;
    },

    updateMarkerIcon() {
        var html = MapUi.buildLayerHtmlIcon( this.model );

        this.ui.markerWrapper.html( html );
    },

    onClickEditMarker() {
        this._radio.commands.execute( 'modal:showEditPoiMarker', this.model );
    },

    onSubmit(e) {
        e.preventDefault();

        this.ui.formGroups.removeClass('has-feedback has-error');

        const fileName = this.ui.layerFile.val();

        if ( !fileName && this.options.isNew ) {
            this.ui.fileFormGroup.addClass('has-feedback has-error');
            return false;
        }
        else if ( fileName ) {
            const extension = extensionname(fileName).toLowerCase();

            if (extension !== 'csv') {
                this.ui.fileFormGroup.addClass('has-feedback has-error');
                return false;
            }
        }


        let updateMarkers = false;
        let updatePopups = false;

        this.model.set('minZoom', 0);
        this.model.set('name', this.ui.layerName.val());
        this.model.set('description', this.ui.layerDescription.val());
        this.model.set('popupContent', this.ui.layerPopupContent.val());

        if ( this._oldModel.get('markerIconType') !== this.model.get('markerIconType') ) {
            updateMarkers = true;
        }

        if ( this._oldModel.get('markerIconUrl') !== this.model.get('markerIconUrl') ) {
            updateMarkers = true;
        }

        if ( this._oldModel.get('markerColor') !== this.model.get('markerColor') ) {
            updateMarkers = true;
        }

        if ( this._oldModel.get('markerIcon') !== this.model.get('markerIcon') ) {
            updateMarkers = true;
        }

        if ( this._oldModel.get('markerShape') !== this.model.get('markerShape') ) {
            updateMarkers = true;
        }

        if ( this._oldModel.get('popupContent') !== this.model.get('popupContent') ) {
            updatePopups = true;
        }



        if ( this.options.isNew ) {
            this.collection.add( this.model );
        }
        else {
            if ( updateMarkers ) {
                this._radio.commands.execute('map:updateLayerStyles', this.model);
            }

            if ( updatePopups ) {
                this._radio.commands.execute('map:updateLayerPopups', this.model);
            }
        }

        if ( fileName ) {
            if ( !this.options.isNew ) {
                this._radio.commands.execute('map:removeLayer', this.model);
            }

            const reader = new FileReader();

            reader.onload = () => {
                const fileContent = reader.result;
                this._radio.commands.execute('map:addTempLayer', this.model, fileContent);
            };

            reader.readAsText( this.ui.layerFile.get(0).files[0] );
        }

        this.close();
    },

    onReset() {
        this.model.set( this._oldModel.toJSON() );

        this.ui.column.one('transitionend', this.render);

        this.close();
    },
});
